import { ForbiddenException } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, UserRole } from '@prisma/client';

import { BackupsService } from './backups.service';

describe('BackupsService manual lifecycle', () => {
  let service: BackupsService;
  let prisma: any;
  let runner: { enqueueManual: jest.Mock };
  let storage: { fileSize: jest.Mock; resolveDumpPath: jest.Mock };
  let manualGate: { createPendingManualJob: jest.Mock };
  let storagePolicy: { resolveForSchedule: jest.Mock };

  const superAdmin = {
    id: 'sa-1',
    email: 'superadmin@emdad.example',
    role: UserRole.super_admin,
    companyId: null,
  };

  beforeEach(() => {
    prisma = {
      backupJob: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sa-1',
          email: 'superadmin@emdad.example',
          fullName: 'Super Admin',
        }),
      },
    };
    runner = { enqueueManual: jest.fn() };
    storage = {
      fileSize: jest.fn().mockResolvedValue(0),
      resolveDumpPath: jest.fn().mockReturnValue('/tmp/job.dump'),
    };
    manualGate = { createPendingManualJob: jest.fn() };
    storagePolicy = { resolveForSchedule: jest.fn().mockResolvedValue('local_only') };

    service = new BackupsService(
      prisma,
      { enabled: true } as never,
      storage as never,
      runner as never,
      {} as never,
      {} as never,
      { isBusy: () => false } as never,
      {} as never,
      {} as never,
      { issue: jest.fn(), buildDownloadUrl: jest.fn() } as never,
      {} as never,
      storagePolicy as never,
      manualGate as never,
    );
  });

  it('persists a pending manual backup and returns it for the history table', async () => {
    const createdAt = new Date();
    manualGate.createPendingManualJob.mockResolvedValue({
      id: 'job-1',
      type: BackupJobType.manual,
      status: BackupJobStatus.pending,
      label: 'nightly check',
      progressPercent: 0,
      bytesWritten: 0n,
      createdAt,
      completedAt: null,
      triggeredBy: { id: 'sa-1', email: 'superadmin@emdad.example', fullName: 'Super Admin' },
      manifest: null,
      dumpFilename: null,
      artifactPath: null,
      localArtifactPurged: false,
      errorMessage: null,
      startedAt: null,
      storagePolicy: 'local_only',
      gdriveSyncStatus: null,
      gdriveSyncedAt: null,
      gdriveFileId: null,
      gdriveSyncError: null,
      gdriveSyncAttempts: 0,
      gdriveNextRetryAt: null,
    });

    const res = await service.createManual(superAdmin as never, { label: 'nightly check' });
    expect(manualGate.createPendingManualJob).toHaveBeenCalledWith({
      triggeredByUserId: 'sa-1',
      label: 'nightly check',
      storagePolicy: 'local_only',
    });
    expect(prisma.backupJob.create).not.toHaveBeenCalled();
    expect(runner.enqueueManual).toHaveBeenCalledWith('job-1', superAdmin);
    expect(res.jobId).toBe('job-1');
    expect(res.status).toBe('pending');
    expect(res.downloadable).toBe(false);
    expect(res.type).toBe('manual');
  });

  it('lists a processing manual backup', async () => {
    prisma.backupJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        type: BackupJobType.manual,
        status: BackupJobStatus.running,
        label: 'in flight',
        progressPercent: 40,
        bytesWritten: 100n,
        createdAt: new Date(),
        completedAt: null,
        triggeredBy: { id: 'sa-1', email: 'a@b.c', fullName: 'A' },
        manifest: null,
        dumpFilename: null,
        artifactPath: null,
        localArtifactPurged: false,
        errorMessage: null,
        startedAt: new Date(),
        storagePolicy: 'local_only',
        gdriveSyncStatus: null,
        gdriveSyncedAt: null,
        gdriveFileId: null,
        gdriveSyncError: null,
        gdriveSyncAttempts: 0,
        gdriveNextRetryAt: null,
      },
    ]);
    prisma.backupJob.count.mockResolvedValue(1);
    const list = await service.list(superAdmin as never, { limit: 20, offset: 0 } as never);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].status).toBe('running');
    expect(list.items[0].downloadable).toBe(false);
  });

  it('marks a completed backup downloadable only when the dump file exists', async () => {
    const row = {
      id: 'job-done',
      type: BackupJobType.manual,
      status: BackupJobStatus.completed,
      label: 'done',
      progressPercent: 100,
      bytesWritten: 2048n,
      createdAt: new Date(),
      completedAt: new Date(),
      triggeredBy: { id: 'sa-1', email: 'a@b.c', fullName: 'A' },
      manifest: null,
      dumpFilename: 'job-done.dump',
      artifactPath: '/backups/job-done',
      localArtifactPurged: false,
      errorMessage: null,
      startedAt: new Date(),
      storagePolicy: 'local_only',
      gdriveSyncStatus: null,
      gdriveSyncedAt: null,
      gdriveFileId: null,
      gdriveSyncError: null,
      gdriveSyncAttempts: 0,
      gdriveNextRetryAt: null,
    };
    prisma.backupJob.findMany.mockResolvedValue([row]);
    prisma.backupJob.count.mockResolvedValue(1);
    storage.fileSize.mockResolvedValue(2048);
    const list = await service.list(superAdmin as never, { limit: 20, offset: 0 } as never);
    expect(list.items[0].downloadable).toBe(true);

    storage.fileSize.mockResolvedValue(0);
    const missing = await service.list(superAdmin as never, { limit: 20, offset: 0 } as never);
    expect(missing.items[0].downloadable).toBe(false);
  });

  it('does not offer download for a failed backup', async () => {
    prisma.backupJob.findMany.mockResolvedValue([
      {
        id: 'job-fail',
        type: BackupJobType.manual,
        status: BackupJobStatus.failed,
        label: 'fail',
        progressPercent: 10,
        bytesWritten: 0n,
        createdAt: new Date(),
        completedAt: new Date(),
        triggeredBy: { id: 'sa-1', email: 'a@b.c', fullName: 'A' },
        manifest: null,
        dumpFilename: null,
        artifactPath: null,
        localArtifactPurged: false,
        errorMessage: 'pg_dump failed',
        startedAt: new Date(),
        storagePolicy: 'local_only',
        gdriveSyncStatus: null,
        gdriveSyncedAt: null,
        gdriveFileId: null,
        gdriveSyncError: null,
        gdriveSyncAttempts: 0,
        gdriveNextRetryAt: null,
      },
    ]);
    prisma.backupJob.count.mockResolvedValue(1);
    const list = await service.list(superAdmin as never, { limit: 20, offset: 0 } as never);
    expect(list.items[0].status).toBe('failed');
    expect(list.items[0].downloadable).toBe(false);
  });

  it('rejects non-super-admin create and cooldown is still enforced server-side', async () => {
    const manager = { ...superAdmin, role: UserRole.wh_manager };
    await expect(service.createManual(manager as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(manualGate.createPendingManualJob).not.toHaveBeenCalled();
  });

  it('keeps download restricted to super admin', async () => {
    const manager = { ...superAdmin, role: UserRole.wh_manager };
    await expect(service.issueDownload(manager as never, 'job-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
