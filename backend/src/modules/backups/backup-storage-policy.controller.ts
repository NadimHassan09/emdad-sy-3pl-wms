import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { BackupStoragePolicyService } from './backup-storage-policy.service';
import { UpdateBackupStoragePolicyDto } from './dto/update-backup-storage-policy.dto';

@Controller('backups/storage-policy')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class BackupStoragePolicyController {
  constructor(private readonly storagePolicy: BackupStoragePolicyService) {}

  @Get()
  @UseGuards(InternalAdminGuard)
  getSettings() {
    return this.storagePolicy.getSettings();
  }

  @Put()
  @UseGuards(SuperAdminGuard)
  update(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateBackupStoragePolicyDto) {
    return this.storagePolicy.updateDefaultPolicy(user, dto);
  }
}
