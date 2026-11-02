import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, BackupStoragePolicy, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STORAGE_SETTINGS_ID } from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';

/** pg_advisory_xact_lock keys — shared across all backend instances. */
export const MANUAL_BACKUP_LOCK_NS = 0x454d4441;
export const MANUAL_BACKUP_LOCK_KEY = 0x4d414e31;

export const DEFAULT_MANUAL_COOLDOWN_SEC = 900;
export const MIN_MANUAL_COOLDOWN_SEC = 60;
export const MAX_MANUAL_COOLDOWN_SEC = 86_400;
export const STALE_BACKUP_JOB_MS = 2 * 60 * 60 * 1000;

const DUMP_JOB_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
];

export type ManualCooldownSnapshot = {
  cooldownSeconds: number;
  cooldownMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  remainingSeconds: number;
  nextAllowedAt: string | null;
  runningManualJobId: string | null;
  canCreate: boolean;
};

@Injectable()
export class BackupManualGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
  ) {}

  resolveCooldownSec(raw: unknown): number {
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
    if (
      !Number.isFinite(n) ||
      n < MIN_MANUAL_COOLDOWN_SEC ||
      n > MAX_MANUAL_COOLDOWN_SEC
    ) {
      return this.fallbackCooldownSec();
    }
    return Math.trunc(n);
  }

  minutesToSeconds(minutes: number): number {
    return this.resolveCooldownSec(Math.trunc(minutes) * 60);
  }

  async getSnapshot(): Promise<ManualCooldownSnapshot> {
    const cooldownSeconds = await this.readCooldownSec();
    const now = Date.now();
    const running = await this.prisma.backupJob.findFirst({
      where: {
        type: BackupJobType.manual,
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const lastManual = await this.prisma.backupJob.findFirst({
      where: { type: BackupJobType.manual },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const nextAllowedMs = lastManual
      ? lastManual.createdAt.getTime() + cooldownSeconds * 1000
      : now;
    const remainingSeconds = Math.max(0, Math.ceil((nextAllowedMs - now) / 1000));
    const blockedByRunning = Boolean(running);
    return {
      cooldownSeconds,
      cooldownMinutes: Math.round(cooldownSeconds / 60),
      minMinutes: MIN_MANUAL_COOLDOWN_SEC / 60,
      maxMinutes: MAX_MANUAL_COOLDOWN_SEC / 60,
      remainingSeconds: blockedByRunning ? Math.max(remainingSeconds, 1) : remainingSeconds,
      nextAllowedAt: remainingSeconds > 0 || blockedByRunning ? new Date(nextAllowedMs).toISOString() : null,
      runningManualJobId: running?.id ?? null,
      canCreate: !blockedByRunning && remainingSeconds <= 0,
    };
  }

  async updateCooldownMinutes(user: AuthPrincipal, minutes: number): Promise<ManualCooldownSnapshot> {
    const cooldownSeconds = this.minutesToSeconds(minutes);
    await this.prisma.backupStorageSettings.upsert({
      where: { id: STORAGE_SETTINGS_ID },
      create: {
        id: STORAGE_SETTINGS_ID,
        defaultPolicy: this.backupConfig.defaultStoragePolicy,
        manualCooldownSec: cooldownSeconds,
        updatedByUserId: user.id,
      },
      update: {
        manualCooldownSec: cooldownSeconds,
        updatedByUserId: user.id,
      },
    });
    return this.getSnapshot();
  }

  /**
   * Atomically reserve a manual backup start. Cooldown is measured from the
   * last manual backup *start* (`createdAt`), not completion, so a long-running
   * dump cannot be used to fire another start. The pending row is created in the
   * same locked transaction so a second instance cannot bypass the gate.
   */
  async assertCanStartManual(): Promise<void> {
    await this.failStaleDumpJobs();
    await this.prisma.$transaction(async (tx) => {
      await this.assertCanStartInsideTx(tx);
    });
  }

  async createPendingManualJob(input: {
    triggeredByUserId: string;
    label: string | null;
    storagePolicy: string;
  }) {
    await this.failStaleDumpJobs();
    return this.prisma.$transaction(async (tx) => {
      await this.assertCanStartInsideTx(tx);
      return tx.backupJob.create({
        data: {
          type: BackupJobType.manual,
          status: BackupJobStatus.pending,
          label: input.label,
          triggeredByUserId: input.triggeredByUserId,
          storagePolicy: input.storagePolicy as BackupStoragePolicy,
          progressPercent: 0,
        },
        include: {
          triggeredBy: { select: { id: true, email: true, fullName: true } },
        },
      });
    });
  }

  private async assertCanStartInsideTx(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${MANUAL_BACKUP_LOCK_NS}::int, ${MANUAL_BACKUP_LOCK_KEY}::int)`,
    );

    const runningManual = await tx.backupJob.findFirst({
      where: {
        type: BackupJobType.manual,
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (runningManual) {
      throw this.runningException(runningManual.id);
    }

    const runningDump = await tx.backupJob.findFirst({
      where: {
        type: { in: DUMP_JOB_TYPES },
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running] },
      },
      select: { id: true, type: true },
    });
    if (runningDump) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          code: 'BACKUP_OPERATION_IN_PROGRESS',
          message: 'A backup operation is already running. Wait for it to finish before starting a manual backup.',
          fields: { runningJobId: runningDump.id },
        },
        HttpStatus.CONFLICT,
      );
    }

    const cooldownSeconds = await this.readCooldownSec(tx);
    const lastManual = await tx.backupJob.findFirst({
      where: { type: BackupJobType.manual },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastManual) {
      const nextAllowedMs = lastManual.createdAt.getTime() + cooldownSeconds * 1000;
      const remainingSeconds = Math.max(0, Math.ceil((nextAllowedMs - Date.now()) / 1000));
      if (remainingSeconds > 0) {
        throw this.cooldownException(remainingSeconds, new Date(nextAllowedMs), cooldownSeconds);
      }
    }
  }

  async failStaleDumpJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_BACKUP_JOB_MS);
    const result = await this.prisma.backupJob.updateMany({
      where: {
        type: { in: DUMP_JOB_TYPES },
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running] },
        createdAt: { lt: cutoff },
      },
      data: {
        status: BackupJobStatus.failed,
        errorMessage: 'Backup job timed out before completion.',
        completedAt: new Date(),
      },
    });
    return result.count;
  }

  private async readCooldownSec(db: PrismaService | Prisma.TransactionClient = this.prisma): Promise<number> {
    const row = await db.backupStorageSettings.findUnique({
      where: { id: STORAGE_SETTINGS_ID },
      select: { manualCooldownSec: true },
    });
    if (!row) return this.fallbackCooldownSec();
    return this.resolveCooldownSec(row.manualCooldownSec);
  }

  private fallbackCooldownSec(): number {
    const n = this.backupConfig.manualCooldownSec;
    if (
      Number.isFinite(n) &&
      n >= MIN_MANUAL_COOLDOWN_SEC &&
      n <= MAX_MANUAL_COOLDOWN_SEC
    ) {
      return Math.trunc(n);
    }
    return DEFAULT_MANUAL_COOLDOWN_SEC;
  }

  private cooldownException(remainingSeconds: number, nextAllowedAt: Date, cooldownSeconds: number) {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'BACKUP_MANUAL_COOLDOWN',
        message: `Please wait ${formatRemaining(remainingSeconds)} before creating another manual backup.`,
        fields: {
          remainingSeconds: String(remainingSeconds),
          nextAllowedAt: nextAllowedAt.toISOString(),
          cooldownSeconds: String(cooldownSeconds),
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private runningException(jobId: string) {
    return new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        code: 'BACKUP_MANUAL_IN_PROGRESS',
        message: 'A manual backup is already running. Wait for it to finish before starting another.',
        fields: { runningJobId: jobId },
      },
      HttpStatus.CONFLICT,
    );
  }
}

export function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}
