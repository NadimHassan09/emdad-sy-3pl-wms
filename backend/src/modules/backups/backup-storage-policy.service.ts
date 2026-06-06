import { BadRequestException, Injectable } from '@nestjs/common';
import { BackupStoragePolicy } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STORAGE_SETTINGS_ID } from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';
import { UpdateBackupStoragePolicyDto } from './dto/update-backup-storage-policy.dto';

@Injectable()
export class BackupStoragePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly audit: AuditLogService,
  ) {}

  async getSettings() {
    const row = await this.ensureSettingsRow();
    return {
      defaultPolicy: row.defaultPolicy,
      envFallbackPolicy: this.backupConfig.defaultStoragePolicy,
      effectiveDefaultPolicy: row.defaultPolicy,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  }

  async updateDefaultPolicy(user: AuthPrincipal, dto: UpdateBackupStoragePolicyDto) {
    this.assertDrivePolicyAllowed(dto.defaultPolicy);

    const row = await this.prisma.backupStorageSettings.upsert({
      where: { id: STORAGE_SETTINGS_ID },
      create: {
        id: STORAGE_SETTINGS_ID,
        defaultPolicy: dto.defaultPolicy,
        updatedByUserId: user.id,
      },
      update: {
        defaultPolicy: dto.defaultPolicy,
        updatedByUserId: user.id,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'backup.storage_policy.updated',
        resourceType: 'backup_storage_settings',
        resourceId: STORAGE_SETTINGS_ID,
        newState: {
          message: `${user.email ?? user.id} updated default backup storage policy`,
          defaultPolicy: row.defaultPolicy,
        },
      }),
    );

    return {
      defaultPolicy: row.defaultPolicy,
      updatedAt: row.updatedAt,
    };
  }

  async resolveForSchedule(schedulePolicy: BackupStoragePolicy | null): Promise<BackupStoragePolicy> {
    if (schedulePolicy) return this.effectivePolicy(schedulePolicy);
    return this.resolveDefault();
  }

  async resolveDefault(): Promise<BackupStoragePolicy> {
    const row = await this.ensureSettingsRow();
    return this.effectivePolicy(row.defaultPolicy);
  }

  /** Applies runtime fallback when Drive is unavailable. */
  effectivePolicy(policy: BackupStoragePolicy): BackupStoragePolicy {
    if (policy === BackupStoragePolicy.local_only) return policy;
    if (!this.backupConfig.gdriveEnabled) return BackupStoragePolicy.local_only;
    return policy;
  }

  shouldSyncToDrive(policy: BackupStoragePolicy): boolean {
    return policy === BackupStoragePolicy.drive_only || policy === BackupStoragePolicy.local_and_drive;
  }

  shouldRetainLocal(policy: BackupStoragePolicy): boolean {
    return policy === BackupStoragePolicy.local_only || policy === BackupStoragePolicy.local_and_drive;
  }

  private async ensureSettingsRow() {
    const existing = await this.prisma.backupStorageSettings.findUnique({
      where: { id: STORAGE_SETTINGS_ID },
    });
    if (existing) return existing;

    return this.prisma.backupStorageSettings.create({
      data: {
        id: STORAGE_SETTINGS_ID,
        defaultPolicy: this.backupConfig.defaultStoragePolicy,
      },
    });
  }

  private assertDrivePolicyAllowed(policy: BackupStoragePolicy): void {
    if (policy === BackupStoragePolicy.local_only) return;
    if (!this.backupConfig.gdriveEnabled) {
      throw new BadRequestException(
        'Drive storage policies require BACKUP_GDRIVE_ENABLED=true and a connected Google Drive account.',
      );
    }
  }
}
