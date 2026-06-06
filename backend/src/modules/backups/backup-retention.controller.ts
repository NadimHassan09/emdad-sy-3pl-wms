import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { BackupDriveRetentionService } from './backup-drive-retention.service';
import { BackupRetentionService } from './backup-retention.service';

/**
 * Backup retention policies and cleanup (BACKUP-4B).
 */
@Controller('backups/retention')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class BackupRetentionController {
  constructor(
    private readonly retention: BackupRetentionService,
    private readonly driveRetention: BackupDriveRetentionService,
  ) {}

  @Get('policies')
  @UseGuards(InternalAdminGuard)
  getPolicies() {
    return this.retention.getPolicies();
  }

  @Get('preview')
  @UseGuards(InternalAdminGuard)
  preview() {
    return this.retention.previewCleanup();
  }

  @Post('cleanup')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  cleanup(@CurrentUser() user: AuthPrincipal) {
    return this.retention.executeCleanup(user);
  }

  @Get('drive/policies')
  @UseGuards(InternalAdminGuard)
  getDrivePolicies() {
    return this.driveRetention.getPolicies();
  }

  @Get('drive/preview')
  @UseGuards(InternalAdminGuard)
  previewDrive() {
    return this.driveRetention.previewCleanup();
  }

  @Post('drive/cleanup')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  cleanupDrive(@CurrentUser() user: AuthPrincipal) {
    return this.driveRetention.executeCleanup(user);
  }
}
