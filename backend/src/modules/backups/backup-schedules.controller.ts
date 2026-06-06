import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { BackupSchedulesService } from './backup-schedules.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@Controller('backups/schedules')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class BackupSchedulesController {
  constructor(private readonly schedules: BackupSchedulesService) {}

  @Get()
  @UseGuards(InternalAdminGuard)
  list() {
    return this.schedules.list();
  }

  @Get(':id')
  @UseGuards(InternalAdminGuard)
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.schedules.findById(id);
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateBackupScheduleDto) {
    return this.schedules.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(SuperAdminGuard)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateBackupScheduleDto,
  ) {
    return this.schedules.update(user, id, dto);
  }

  @Post(':id/run-now')
  @UseGuards(SuperAdminGuard)
  runNow(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.schedules.runNow(user, id);
  }
}
