import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { BackupManualGateService } from './backup-manual-gate.service';
import { UpdateManualCooldownDto } from './dto/update-manual-cooldown.dto';

@Controller('backups/manual-cooldown')
@UseGuards(RolesGuard, SuperAdminGuard)
@Roles(AuthGroup.ADMIN)
export class BackupManualCooldownController {
  constructor(private readonly gate: BackupManualGateService) {}

  @Get()
  getSettings() {
    return this.gate.getSnapshot();
  }

  @Put()
  update(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateManualCooldownDto) {
    return this.gate.updateCooldownMinutes(user, dto.cooldownMinutes);
  }
}
