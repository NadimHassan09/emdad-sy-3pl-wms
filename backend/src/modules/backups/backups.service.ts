import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Prisma, UserRole } from '@prisma/client';
import { createReadStream } from 'fs';
import { copyFile, unlink } from 'fs/promises';
import type { Readable } from 'stream';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { isInternalAdminRole } from '../../common/auth/rbac-policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupDriveSyncService } from './backup-drive-sync.service';
import { BackupDownloadTokenService } from './backup-download-token.service';
import { BackupFactoryResetService } from './backup-factory-reset.service';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { BackupManifest, BackupStorageService } from './backup-storage.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupPgToolsService } from './backup-pg-tools.service';
import { BackupRestoreRunnerService } from './backup-restore-runner.service';
import { BackupRunnerService } from './backup-runner.service';
import { BackupStoragePolicyService } from './backup-storage-policy.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { FactoryResetDto } from './dto/factory-reset.dto';
import { ListBackupsQueryDto } from './dto/list-backups-query.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

const DOWNLOADABLE_BACKUP_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
];

@Injectable()
export class BackupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly runner: BackupRunnerService,
    private readonly restoreRunner: BackupRestoreRunnerService,
    private readonly factoryResetRunner: BackupFactoryResetService,
    private readonly operations: BackupOperationsService,
    private readonly maintenance: BackupMaintenanceService,
    private readonly pg: BackupPgToolsService,
    private readonly downloadTokens: BackupDownloadTokenService,
    private readonly driveSync: BackupDriveSyncService,
    private readonly storagePolicy: BackupStoragePolicyService,
  ) {}

  private assertEnabled(): void {
    if (!this.backupConfig.enabled) {
      throw new ServiceUnavailableException('Backup feature is disabled.');
    }
  }

  private assertCanRead(user: AuthPrincipal): void {
    if (!isInternalAdminRole(user.role)) {
      throw new ForbiddenException('Backup history requires warehouse manager or super admin.');
    }
  }

  async createManual(user: AuthPrincipal, dto: CreateBackupDto) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can create backups.');
    }
    if (this.operations.isBusy()) {
      throw new BadRequestException('A backup operation is already running.');
    }

    const cooldownMs = this.backupConfig.manualCooldownSec * 1000;
    const recent = await this.prisma.backupJob.findFirst({
      where: {
        type: BackupJobType.manual,
        triggeredByUserId: user.id,
        createdAt: { gte: new Date(Date.now() - cooldownMs) },
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running, BackupJobStatus.completed] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(
        `Please wait before creating another manual backup (cooldown ${this.backupConfig.manualCooldownSec}s).`,
      );
    }

    const resolvedPolicy = await this.storagePolicy.resolveForSchedule(dto.storagePolicy ?? null);

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.manual,
        status: BackupJobStatus.pending,
        label: dto.label?.trim() || null,
        triggeredByUserId: user.id,
        storagePolicy: resolvedPolicy,
        progressPercent: 0,
      },
      select: { id: true, status: true, createdAt: true, storagePolicy: true },
    });

    this.runner.enqueueManual(job.id, user);

    return {
      jobId: job.id,
      status: job.status,
      storagePolicy: job.storagePolicy,
      createdAt: job.createdAt,
    };
  }

  async syncDrive(user: AuthPrincipal, jobId: string) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can sync backups to Google Drive.');
    }

    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found.');
    if (job.status !== BackupJobStatus.completed) {
      throw new BadRequestException('Only completed backups can be synced to Google Drive.');
    }
    if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy)) {
      throw new BadRequestException('This backup uses a local-only storage policy.');
    }

    await this.driveSync.syncJob(jobId, user);
    const updated = await this.prisma.backupJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        gdriveSyncStatus: true,
        gdriveFileId: true,
        gdriveSyncedAt: true,
        gdriveSyncError: true,
        gdriveSyncAttempts: true,
        gdriveNextRetryAt: true,
      },
    });

    return updated;
  }

  async list(user: AuthPrincipal, query: ListBackupsQueryDto) {
    this.assertCanRead(user);
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.backupJob.findMany({
        where: {
          type: { in: [BackupJobType.manual, BackupJobType.upload, BackupJobType.restore, BackupJobType.pre_snapshot] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          triggeredBy: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.backupJob.count({
        where: {
          type: { in: [BackupJobType.manual, BackupJobType.upload, BackupJobType.restore, BackupJobType.pre_snapshot] },
        },
      }),
    ]);

    return {
      items: items.map((row) => this.toSummary(row)),
      total,
      limit,
      offset,
    };
  }

  async findById(user: AuthPrincipal, id: string) {
    this.assertCanRead(user);
    const job = await this.prisma.backupJob.findUnique({
      where: { id },
      include: {
        triggeredBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!job) throw new NotFoundException('Backup job not found.');
    return this.toDetail(job);
  }

  async getStatus(user: AuthPrincipal, id: string) {
    this.assertCanRead(user);
    const job = await this.prisma.backupJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        progressPercent: true,
        bytesWritten: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });
    if (!job) throw new NotFoundException('Backup job not found.');
    return {
      id: job.id,
      status: job.status,
      progressPercent: job.progressPercent,
      bytesWritten: Number(job.bytesWritten),
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  async issueDownload(user: AuthPrincipal, id: string) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can download backups.');
    }

    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    await this.assertDownloadableJob(job);

    const { token, expiresAt, expiresInSec } = this.downloadTokens.issue(id, user.id);
    const downloadUrl = this.downloadTokens.buildDownloadUrl(id, token);

    return {
      backupId: id,
      token,
      downloadUrl,
      expiresAt,
      expiresInSec,
    };
  }

  getActiveOperation() {
    return {
      busy: this.operations.isBusy(),
      activeJobId: this.operations.getActiveJobId(),
      maintenance: this.maintenance.isActive(),
      maintenanceReason: this.maintenance.getReason(),
    };
  }

  async uploadBackup(user: AuthPrincipal, file: UploadedBackupFile) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can upload backups.');
    }
    if (!file?.path) {
      throw new BadRequestException('Backup file is required.');
    }
    if (!file.originalname.toLowerCase().endsWith('.dump')) {
      throw new BadRequestException('Only PostgreSQL custom dump files (.dump) are accepted.');
    }
    if (file.size > this.backupConfig.maxUploadBytes) {
      throw new BadRequestException('Uploaded file exceeds maximum allowed size.');
    }

    const resolvedPolicy = await this.storagePolicy.resolveDefault();

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.upload,
        status: BackupJobStatus.running,
        label: file.originalname,
        triggeredByUserId: user.id,
        storagePolicy: resolvedPolicy,
        startedAt: new Date(),
        progressPercent: 10,
      },
    });

    try {
      await this.storage.ensureJobDir(job.id);
      const artifactPath = this.storage.jobDirectory(job.id);
      const dumpFilename = `${job.id}.dump`;
      const dumpPath = this.storage.dumpPath(job.id);

      await copyFile(file.path, dumpPath);
      await unlink(file.path).catch(() => undefined);

      const validation = await this.pg.validateDumpFile(dumpPath);
      if (!validation.valid) {
        throw new BadRequestException(validation.error ?? 'Invalid backup file.');
      }

      const sizeBytes = await this.storage.fileSize(dumpPath);
      const checksumSha256 = await this.storage.sha256File(dumpPath);
      const manifest: BackupManifest = {
        backupId: job.id,
        type: BackupJobType.upload,
        label: file.originalname,
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

      await this.storage.writeManifest(job.id, manifest);

      await this.prisma.backupJob.update({
        where: { id: job.id },
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

      this.driveSync.enqueue(job.id, user);

      return {
        jobId: job.id,
        status: BackupJobStatus.completed,
        sizeBytes,
        checksumSha256,
        tocEntries: validation.tocEntries,
      };
    } catch (err) {
      await this.storage.removeJobArtifacts(job.id).catch(() => undefined);
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupJobStatus.failed,
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  async restoreBackup(user: AuthPrincipal, sourceBackupId: string, dto: RestoreBackupDto) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can restore backups.');
    }
    if (this.operations.isBusy()) {
      throw new BadRequestException('A backup operation is already running.');
    }

    const source = await this.prisma.backupJob.findUnique({ where: { id: sourceBackupId } });
    if (!source) throw new NotFoundException('Source backup not found.');
    if (source.status !== BackupJobStatus.completed) {
      throw new BadRequestException('Source backup must be completed before restore.');
    }
    if (source.type !== BackupJobType.manual && source.type !== BackupJobType.upload) {
      throw new BadRequestException('This backup type cannot be used as a restore source.');
    }

    const restoreJob = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.restore,
        status: BackupJobStatus.pending,
        label: `restore:${sourceBackupId}`,
        triggeredByUserId: user.id,
        parentJobId: sourceBackupId,
        progressPercent: 0,
      },
    });

    this.restoreRunner.enqueueRestore(
      restoreJob.id,
      sourceBackupId,
      user,
      dto.createPreSnapshot !== false,
    );

    return {
      restoreJobId: restoreJob.id,
      sourceBackupId,
      status: restoreJob.status,
    };
  }

  async factoryReset(user: AuthPrincipal, dto: FactoryResetDto) {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can execute factory reset.');
    }
    if (!this.backupConfig.factoryResetEnabled) {
      throw new ForbiddenException('Factory reset is disabled on this environment.');
    }
    if (this.operations.isBusy()) {
      throw new BadRequestException('A backup operation is already running.');
    }

    const resetJob = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.factory_reset,
        status: BackupJobStatus.pending,
        label: 'factory-reset',
        triggeredByUserId: user.id,
        progressPercent: 0,
      },
    });

    this.factoryResetRunner.enqueueFactoryReset(
      resetJob.id,
      user,
      dto.createPreSnapshot !== false,
    );

    return {
      resetJobId: resetJob.id,
      status: resetJob.status,
    };
  }

  async streamDownload(
    user: AuthPrincipal,
    id: string,
    token: string,
  ): Promise<{ stream: Readable; filename: string; sizeBytes: number }> {
    this.assertEnabled();
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only super admin can download backups.');
    }

    this.downloadTokens.verify(token, id, user.id);

    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    await this.assertDownloadableJob(job);

    const filePath = this.storage.resolveDumpPath(job!.artifactPath, job!.dumpFilename, id);
    const sizeBytes = await this.storage.fileSize(filePath);
    if (sizeBytes <= 0) {
      throw new NotFoundException('Backup dump file is missing on disk.');
    }

    const filename = job!.dumpFilename ?? `${id}.dump`;
    return {
      stream: createReadStream(filePath),
      filename,
      sizeBytes,
    };
  }

  private async assertDownloadableJob(
    job: {
      id: string;
      type: BackupJobType;
      status: BackupJobStatus;
      artifactPath: string | null;
      dumpFilename: string | null;
    } | null,
  ): Promise<void> {
    if (!job) throw new NotFoundException('Backup job not found.');
    if (job.status !== BackupJobStatus.completed) {
      throw new BadRequestException('Backup is not ready for download.');
    }
    if (!DOWNLOADABLE_BACKUP_TYPES.includes(job.type)) {
      throw new BadRequestException(
        `Backup type "${job.type}" does not have a downloadable dump file.`,
      );
    }

    const filePath = this.storage.resolveDumpPath(job.artifactPath, job.dumpFilename, job.id);
    const sizeBytes = await this.storage.fileSize(filePath);
    if (sizeBytes <= 0) {
      throw new NotFoundException('Backup dump file is missing on disk.');
    }
  }

  private toSummary(row: BackupJobRow) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      label: row.label,
      progressPercent: row.progressPercent,
      bytesWritten: Number(row.bytesWritten),
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      triggeredBy: row.triggeredBy,
      manifest: row.manifest,
    };
  }

  private toDetail(row: BackupJobRow) {
    return {
      ...this.toSummary(row),
      dumpFilename: row.dumpFilename,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
    };
  }
}

export type UploadedBackupFile = {
  path: string;
  originalname: string;
  size: number;
};

type BackupJobRow = {
  id: string;
  type: BackupJobType;
  status: BackupJobStatus;
  label: string | null;
  progressPercent: number;
  bytesWritten: bigint;
  manifest: unknown;
  dumpFilename: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  triggeredBy: { id: string; email: string; fullName: string };
};
