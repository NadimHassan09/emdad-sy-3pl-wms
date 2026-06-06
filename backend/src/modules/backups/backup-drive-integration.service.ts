import { Injectable } from '@nestjs/common';
import { BackupDriveSyncStatus, BackupJobStatus } from '@prisma/client';

import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';

export type BackupDriveIntegrationView = {
  connected: boolean;
  folderId: string | null;
  connectedAt: string | null;
  connectedBy: { id: string; email: string; fullName: string } | null;
};

export type BackupDriveSyncFailureView = {
  id: string;
  type: string;
  label: string | null;
  completedAt: string | null;
  storagePolicy: string;
  gdriveSyncError: string | null;
  gdriveSyncAttempts: number;
  gdriveNextRetryAt: string | null;
};

export type BackupDriveAdminStatusView = BackupDriveIntegrationView & {
  rootFolderName: string;
  gdriveEnabled: boolean;
  gdriveConfigured: boolean;
  lastSyncedAt: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  syncFailures: BackupDriveSyncFailureView[];
};

@Injectable()
export class BackupDriveIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly backupConfig: BackupConfig,
  ) {}

  async getStatus(): Promise<BackupDriveIntegrationView> {
    const admin = await this.getAdminStatus();
    return {
      connected: admin.connected,
      folderId: admin.folderId,
      connectedAt: admin.connectedAt,
      connectedBy: admin.connectedBy,
    };
  }

  async getAdminStatus(): Promise<BackupDriveAdminStatusView> {
    const base = await this.getConnectionView();
    const [lastSynced, pendingSyncCount, failedSyncCount, syncFailures] = await Promise.all([
      this.prisma.backupJob.findFirst({
        where: { gdriveSyncStatus: BackupDriveSyncStatus.synced },
        orderBy: { gdriveSyncedAt: 'desc' },
        select: { gdriveSyncedAt: true },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.completed,
          gdriveSyncStatus: BackupDriveSyncStatus.pending,
        },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.completed,
          gdriveSyncStatus: BackupDriveSyncStatus.failed,
        },
      }),
      this.prisma.backupJob.findMany({
        where: {
          status: BackupJobStatus.completed,
          gdriveSyncStatus: BackupDriveSyncStatus.failed,
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        select: {
          id: true,
          type: true,
          label: true,
          completedAt: true,
          storagePolicy: true,
          gdriveSyncError: true,
          gdriveSyncAttempts: true,
          gdriveNextRetryAt: true,
        },
      }),
    ]);

    return {
      ...base,
      rootFolderName: this.backupConfig.gdriveRootFolderName,
      gdriveEnabled: this.backupConfig.gdriveEnabled,
      gdriveConfigured: this.backupConfig.gdriveConfigured(),
      lastSyncedAt: lastSynced?.gdriveSyncedAt?.toISOString() ?? null,
      pendingSyncCount,
      failedSyncCount,
      syncFailures: syncFailures.map((row) => ({
        id: row.id,
        type: row.type,
        label: row.label,
        completedAt: row.completedAt?.toISOString() ?? null,
        storagePolicy: row.storagePolicy,
        gdriveSyncError: row.gdriveSyncError,
        gdriveSyncAttempts: row.gdriveSyncAttempts,
        gdriveNextRetryAt: row.gdriveNextRetryAt?.toISOString() ?? null,
      })),
    };
  }

  private async getConnectionView(): Promise<BackupDriveIntegrationView> {
    const row = await this.prisma.backupDriveIntegration.findFirst({
      orderBy: { connectedAt: 'desc' },
      include: {
        connectedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!row) {
      return {
        connected: false,
        folderId: null,
        connectedAt: null,
        connectedBy: null,
      };
    }
    return {
      connected: true,
      folderId: this.encryption.decrypt(row.encryptedFolderId),
      connectedAt: row.connectedAt.toISOString(),
      connectedBy: row.connectedBy,
    };
  }

  async isConnected(): Promise<boolean> {
    const count = await this.prisma.backupDriveIntegration.count();
    return count > 0;
  }

  async getRefreshToken(): Promise<string | null> {
    const row = await this.prisma.backupDriveIntegration.findFirst({
      orderBy: { connectedAt: 'desc' },
    });
    if (!row) return null;
    return this.encryption.decrypt(row.encryptedRefreshToken);
  }

  async getFolderId(): Promise<string | null> {
    const row = await this.prisma.backupDriveIntegration.findFirst({
      orderBy: { connectedAt: 'desc' },
    });
    if (!row) return null;
    return this.encryption.decrypt(row.encryptedFolderId);
  }

  async saveConnection(input: {
    refreshToken: string;
    folderId: string;
    connectedByUserId: string;
  }): Promise<void> {
    const encryptedRefreshToken = this.encryption.encrypt(input.refreshToken);
    const encryptedFolderId = this.encryption.encrypt(input.folderId);

    await this.prisma.$transaction([
      this.prisma.backupDriveIntegration.deleteMany(),
      this.prisma.backupDriveIntegration.create({
        data: {
          encryptedRefreshToken,
          encryptedFolderId,
          connectedByUserId: input.connectedByUserId,
          connectedAt: new Date(),
        },
      }),
    ]);
  }

  async disconnect(): Promise<boolean> {
    const result = await this.prisma.backupDriveIntegration.deleteMany();
    return result.count > 0;
  }
}
