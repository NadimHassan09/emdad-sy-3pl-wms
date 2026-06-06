import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Prisma, UserRole } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FACTORY_RESET_TRUNCATE_TABLES,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_ID,
} from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { BackupManifest, BackupStorageService } from './backup-storage.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupPgToolsService } from './backup-pg-tools.service';

@Injectable()
export class BackupFactoryResetService {
  private readonly logger = new Logger(BackupFactoryResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly pg: BackupPgToolsService,
    private readonly maintenance: BackupMaintenanceService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
  ) {}

  enqueueFactoryReset(resetJobId: string, user: AuthPrincipal, createPreSnapshot: boolean): void {
    if (!this.operations.tryAcquire(resetJobId)) {
      void this.markFailed(resetJobId, 'Another backup operation is already running.');
      return;
    }

    void this.runFactoryReset(resetJobId, user, createPreSnapshot).finally(() => {
      this.operations.release(resetJobId);
      this.maintenance.disable();
    });
  }

  private async runFactoryReset(
    resetJobId: string,
    user: AuthPrincipal,
    createPreSnapshot: boolean,
  ): Promise<void> {
    let preSnapshotId: string | null = null;

    try {
      this.maintenance.enable('factory_reset');

      await this.prisma.backupJob.update({
        where: { id: resetJobId },
        data: {
          status: BackupJobStatus.running,
          startedAt: new Date(),
          progressPercent: 5,
        },
      });

      if (createPreSnapshot || this.backupConfig.preSnapshotRequired) {
        preSnapshotId = await this.createPreSnapshot(resetJobId, user);
        await this.updateProgress(resetJobId, 20, 0);
      }

      await this.updateProgress(resetJobId, 30, 0);
      await this.wipeBusinessData();
      await this.updateProgress(resetJobId, 55, 0);

      await this.pg.runDbSeed();
      await this.updateProgress(resetJobId, 80, 0);

      await this.ensureSuperAdminPreserved();
      await this.updateProgress(resetJobId, 92, 0);

      await this.pg.invalidateAllSessions();
      await this.updateProgress(resetJobId, 98, 0);

      await this.prisma.backupJob.update({
        where: { id: resetJobId },
        data: {
          status: BackupJobStatus.completed,
          progressPercent: 100,
          completedAt: new Date(),
          errorMessage: null,
          manifest: {
            preSnapshotId,
            resetAt: new Date().toISOString(),
            preservedSuperAdminId: SUPER_ADMIN_ID,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: 'system.factory_reset',
          resourceType: 'backup_job',
          resourceId: resetJobId,
          newState: {
            message: `${user.email ?? user.id} executed factory reset`,
            resetJobId,
            preSnapshotId,
          },
        }),
      );

      this.logger.log(`Factory reset ${resetJobId} completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Factory reset ${resetJobId} failed: ${message}`);

      if (preSnapshotId) {
        try {
          const snap = await this.prisma.backupJob.findUnique({ where: { id: preSnapshotId } });
          if (snap?.artifactPath && snap.dumpFilename) {
            const snapPath = this.storage.resolveDumpPath(
              snap.artifactPath,
              snap.dumpFilename,
              preSnapshotId,
            );
            await this.pg.runPgRestoreFullReplace(snapPath);
            await this.pg.runPrismaMigrateDeploy();
            await this.pg.invalidateAllSessions();
            await this.markFailed(
              resetJobId,
              `${message} — automatic rollback from pre-snapshot ${preSnapshotId} completed.`,
            );
          } else {
            await this.markFailed(resetJobId, `${message} — rollback snapshot missing.`);
          }
        } catch (rollbackErr) {
          const rollbackMsg =
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
          await this.markFailed(
            resetJobId,
            `${message} — rollback failed: ${rollbackMsg}. Use pre-snapshot ${preSnapshotId}.`,
          );
        }
      } else {
        await this.markFailed(resetJobId, message);
      }

      await this.audit.logBestEffort(
        this.audit.fromPrincipal(user, {
          action: 'system.factory_reset_failed',
          resourceType: 'backup_job',
          resourceId: resetJobId,
          newState: { message, preSnapshotId },
        }),
      );
    }
  }

  private async wipeBusinessData(): Promise<void> {
    for (const table of FACTORY_RESET_TRUNCATE_TABLES) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }

    await this.prisma.user.deleteMany({
      where: { id: { not: SUPER_ADMIN_ID } },
    });
  }

  private async ensureSuperAdminPreserved(): Promise<void> {
    const admin = await this.prisma.user.findUnique({ where: { id: SUPER_ADMIN_ID } });
    if (!admin || admin.role !== UserRole.super_admin) {
      throw new Error(`Super admin account ${SUPER_ADMIN_EMAIL} was not preserved after factory reset.`);
    }
  }

  private async createPreSnapshot(parentJobId: string, user: AuthPrincipal): Promise<string> {
    const preJob = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.pre_snapshot,
        status: BackupJobStatus.running,
        label: `pre-reset:${parentJobId}`,
        triggeredByUserId: user.id,
        parentJobId,
        startedAt: new Date(),
      },
    });

    const preId = preJob.id;
    await this.storage.ensureJobDir(preId);
    const artifactPath = this.storage.jobDirectory(preId);
    const dumpFilename = `${preId}.dump`;
    const dumpPath = this.storage.dumpPath(preId);

    await this.pg.runPgDump(dumpPath);
    const sizeBytes = await this.storage.fileSize(dumpPath);
    const checksumSha256 = await this.storage.sha256File(dumpPath);
    const manifest: BackupManifest = {
      backupId: preId,
      type: BackupJobType.pre_snapshot,
      label: preJob.label,
      environmentId: this.backupConfig.environmentId,
      dbName: this.pg.parseDbName(this.pg.getDatabaseUrl()),
      pgVersion: await this.pg.queryPgVersion(),
      schemaMigration: await this.pg.latestMigrationName(),
      sizeBytes,
      checksumSha256,
      dumpFilename,
      createdAt: new Date().toISOString(),
      createdByUserId: user.id,
      createdByEmail: user.email ?? `user-${user.id}`,
    };

    await this.storage.writeManifest(preId, manifest);
    await this.prisma.backupJob.update({
      where: { id: preId },
      data: {
        status: BackupJobStatus.completed,
        progressPercent: 100,
        artifactPath,
        dumpFilename,
        bytesWritten: BigInt(sizeBytes),
        manifest: manifest as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return preId;
  }

  private async updateProgress(jobId: string, progressPercent: number, bytesWritten: number): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
        bytesWritten: BigInt(bytesWritten),
      },
    });
  }

  private async markFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.failed,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }
}
