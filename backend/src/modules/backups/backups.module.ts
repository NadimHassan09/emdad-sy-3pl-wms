import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { AuthModule } from '../auth/auth.module';
import { BackupConfig } from './backup-config';
import { BackupDriveAuthService } from './backup-drive-auth.service';
import { BackupDriveController } from './backup-drive.controller';
import { BackupDriveIntegrationService } from './backup-drive-integration.service';
import { BackupDriveService } from './backup-drive.service';
import { BackupDriveRetentionCleanupService } from './backup-drive-retention-cleanup.service';
import { BackupDriveRetentionService } from './backup-drive-retention.service';
import { BackupDriveRetryService } from './backup-drive-retry.service';
import { BackupDriveSyncService } from './backup-drive-sync.service';
import { BackupStoragePolicyController } from './backup-storage-policy.controller';
import { BackupStoragePolicyService } from './backup-storage-policy.service';
import { BackupFileEncryptionService } from './backup-file-encryption.service';
import { BackupDownloadTokenService } from './backup-download-token.service';
import { BackupHealthAlertService } from './backup-health-alert.service';
import { BackupHealthService } from './backup-health.service';
import { BackupFactoryResetService } from './backup-factory-reset.service';
import { BackupMaintenanceMiddleware } from './backup-maintenance.middleware';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupPgToolsService } from './backup-pg-tools.service';
import { BackupRestoreRunnerService } from './backup-restore-runner.service';
import { BackupRunnerService } from './backup-runner.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupRetentionCleanupService } from './backup-retention-cleanup.service';
import { BackupRetentionController } from './backup-retention.controller';
import { BackupRetentionService } from './backup-retention.service';
import { BackupSchedulesController } from './backup-schedules.controller';
import { BackupSchedulesService } from './backup-schedules.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [
    BackupDriveController,
    BackupSchedulesController,
    BackupRetentionController,
    BackupStoragePolicyController,
    BackupsController,
  ],
  providers: [
    BackupConfig,
    BackupDriveIntegrationService,
    BackupDriveService,
    BackupDriveAuthService,
    BackupDriveSyncService,
    BackupDriveRetryService,
    BackupDriveRetentionService,
    BackupDriveRetentionCleanupService,
    BackupStoragePolicyService,
    BackupFileEncryptionService,
    BackupStorageService,
    BackupDownloadTokenService,
    BackupPgToolsService,
    BackupOperationsService,
    BackupMaintenanceService,
    BackupRunnerService,
    BackupRestoreRunnerService,
    BackupFactoryResetService,
    BackupSchedulerService,
    BackupRetentionService,
    BackupRetentionCleanupService,
    BackupHealthService,
    BackupHealthAlertService,
    BackupSchedulesService,
    BackupsService,
    SuperAdminGuard,
  ],
  exports: [BackupsService, BackupMaintenanceService],
})
export class BackupsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(BackupMaintenanceMiddleware).forRoutes('*');
  }
}
