import { HttpException, HttpStatus } from '@nestjs/common';
import { BackupJobStatus, BackupJobType } from '@prisma/client';

import {
  BackupManualGateService,
  DEFAULT_MANUAL_COOLDOWN_SEC,
  STALE_BACKUP_JOB_MS,
} from './backup-manual-gate.service';

describe('BackupManualGateService', () => {
  let service: BackupManualGateService;
  let prisma: any;
  let backupConfig: { manualCooldownSec: number; defaultStoragePolicy: string };

  beforeEach(() => {
    prisma = {
      backupJob: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      backupStorageSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    backupConfig = {
      manualCooldownSec: DEFAULT_MANUAL_COOLDOWN_SEC,
      defaultStoragePolicy: 'local_only',
    };
    service = new BackupManualGateService(prisma, backupConfig as never);
  });

  function mockTx(overrides: Record<string, any> = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      backupJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        ...overrides.backupJob,
      },
      backupStorageSettings: {
        findUnique: jest.fn().mockResolvedValue({ manualCooldownSec: DEFAULT_MANUAL_COOLDOWN_SEC }),
        ...overrides.backupStorageSettings,
      },
    };
    prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    return tx;
  }

  it('defaults cooldown to 15 minutes when the setting is missing', async () => {
    prisma.backupStorageSettings.findUnique.mockResolvedValue(null);
    prisma.backupJob.findFirst.mockResolvedValue(null);
    const snap = await service.getSnapshot();
    expect(snap.cooldownSeconds).toBe(900);
    expect(snap.cooldownMinutes).toBe(15);
    expect(snap.canCreate).toBe(true);
  });

  it('uses a safe default when the stored cooldown is invalid', async () => {
    prisma.backupStorageSettings.findUnique.mockResolvedValue({ manualCooldownSec: -12 });
    prisma.backupJob.findFirst.mockResolvedValue(null);
    const snap = await service.getSnapshot();
    expect(snap.cooldownSeconds).toBe(DEFAULT_MANUAL_COOLDOWN_SEC);
  });

  it('rejects a second start during cooldown and reports remaining time', async () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000);
    mockTx({
      backupJob: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ createdAt }),
      },
    });
    let caught: HttpException | null = null;
    try {
      await service.assertCanStartManual();
    } catch (err) {
      caught = err as HttpException;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect(caught!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const res = caught!.getResponse() as Record<string, any>;
    expect(res.code).toBe('BACKUP_MANUAL_COOLDOWN');
    expect(Number(res.fields.remainingSeconds)).toBeGreaterThan(0);
    expect(res.fields.nextAllowedAt).toBeTruthy();
  });

  it('allows a new manual backup after cooldown expiry when nothing is running', async () => {
    const createdAt = new Date(Date.now() - 16 * 60 * 1000);
    mockTx({
      backupJob: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ createdAt }),
      },
    });
    await expect(service.assertCanStartManual()).resolves.toBeUndefined();
  });

  it('rejects a concurrent manual backup while one is still running', async () => {
    mockTx({
      backupJob: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 'run-1' }),
      },
    });
    await expect(service.assertCanStartManual()).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });

  it('takes a postgres advisory lock so multiple instances cannot bypass cooldown', async () => {
    const tx = mockTx();
    await service.assertCanStartManual();
    expect(tx.$executeRaw).toHaveBeenCalled();
    const sql = String(tx.$executeRaw.mock.calls[0][0].strings?.join('') ?? tx.$executeRaw.mock.calls[0][0]);
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  it('ignores scheduled backups when computing the manual cooldown window', async () => {
    const tx = mockTx({
      backupJob: {
        findFirst: jest.fn().mockImplementation((args: { where?: { type?: unknown } }) => {
          const type = args?.where?.type;
          if (type === BackupJobType.scheduled) {
            return { createdAt: new Date(), id: 'sched-1', type: BackupJobType.scheduled };
          }
          return null;
        }),
      },
    });
    await expect(service.assertCanStartManual()).resolves.toBeUndefined();
    const types = tx.backupJob.findFirst.mock.calls.map(
      (call: [{ where?: { type?: unknown } }]) => call[0]?.where?.type,
    );
    expect(types).toContain(BackupJobType.manual);
    expect(types).not.toContain(BackupJobType.scheduled);
  });

  it('creates the pending manual row inside the advisory lock transaction', async () => {
    const tx = mockTx({
      backupJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'job-lock-1',
          type: BackupJobType.manual,
          status: BackupJobStatus.pending,
          triggeredBy: { id: 'u1', email: 'sa@emdad.example', fullName: 'SA' },
        }),
      },
    });
    const job = await service.createPendingManualJob({
      triggeredByUserId: 'u1',
      label: 'locked create',
      storagePolicy: 'local_only',
    });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.backupJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: BackupJobType.manual,
          status: BackupJobStatus.pending,
          label: 'locked create',
        }),
      }),
    );
    expect(job.id).toBe('job-lock-1');
  });

  it('does not cancel running jobs when the cooldown setting is updated', async () => {
    prisma.backupStorageSettings.upsert.mockResolvedValue({ manualCooldownSec: 1800 });
    prisma.backupStorageSettings.findUnique.mockResolvedValue({ manualCooldownSec: 1800 });
    prisma.backupJob.findFirst.mockResolvedValue(null);
    const user = { id: 'u1', email: 'sa@emdad.example', role: 'super_admin' } as never;
    await service.updateCooldownMinutes(user, 30);
    expect(prisma.backupJob.updateMany).not.toHaveBeenCalled();
  });

  it('persists an updated cooldown and uses it for later attempts', async () => {
    prisma.backupStorageSettings.upsert.mockResolvedValue({ manualCooldownSec: 120 });
    prisma.backupStorageSettings.findUnique.mockResolvedValue({ manualCooldownSec: 120 });
    prisma.backupJob.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 60 * 1000),
    });
    const user = { id: 'u1', email: 'sa@emdad.example', role: 'super_admin' } as never;
    const snap = await service.updateCooldownMinutes(user, 2);
    expect(prisma.backupStorageSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ manualCooldownSec: 120 }),
      }),
    );
    expect(snap.cooldownMinutes).toBe(2);
    expect(snap.remainingSeconds).toBeGreaterThan(0);
    expect(snap.canCreate).toBe(false);
  });

  it('fails dump jobs stuck in processing for more than two hours', async () => {
    prisma.backupJob.updateMany.mockResolvedValue({ count: 2 });
    const n = await service.failStaleDumpJobs();
    expect(n).toBe(2);
    const arg = prisma.backupJob.updateMany.mock.calls[0][0];
    expect(arg.where.status.in).toEqual([BackupJobStatus.pending, BackupJobStatus.running]);
    expect(arg.where.createdAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - STALE_BACKUP_JOB_MS + 1000);
    expect(arg.data.status).toBe(BackupJobStatus.failed);
  });
});
