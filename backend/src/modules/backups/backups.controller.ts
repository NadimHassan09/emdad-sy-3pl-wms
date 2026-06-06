import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import * as os from 'os';
import * as path from 'path';
import { diskStorage } from 'multer';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { BackupHealthAlertService } from './backup-health-alert.service';
import { BackupHealthService } from './backup-health.service';
import { BackupsService, type UploadedBackupFile } from './backups.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { FactoryResetDto } from './dto/factory-reset.dto';
import { ListBackupsQueryDto } from './dto/list-backups-query.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

/**
 * Backup engine — manual backup, upload, restore, factory reset (BACKUP-2/3).
 */
@Controller('backups')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly backupHealth: BackupHealthService,
    private readonly backupHealthAlerts: BackupHealthAlertService,
  ) {}

  @Get('health')
  @UseGuards(InternalAdminGuard)
  getHealth() {
    return this.backupHealth.getHealth();
  }

  @Post('health/evaluate-alerts')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  evaluateHealthAlerts() {
    return this.backupHealthAlerts.evaluateNow();
  }

  @Get('operations/active')
  @UseGuards(InternalAdminGuard)
  getActiveOperation() {
    return this.backups.getActiveOperation();
  }

  @Post('upload')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (
          _req: Express.Request,
          file: { originalname: string },
          cb: (err: Error | null, name: string) => void,
        ) => {
          cb(null, `wms-upload-${Date.now()}-${path.basename(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() file: UploadedBackupFile,
  ) {
    return this.backups.uploadBackup(user, file);
  }

  @Post('factory-reset')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 2, ttl: 300_000 } })
  factoryReset(@CurrentUser() user: AuthPrincipal, @Body() dto: FactoryResetDto) {
    return this.backups.factoryReset(user, dto);
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateBackupDto) {
    return this.backups.createManual(user, dto);
  }

  @Get()
  @UseGuards(InternalAdminGuard)
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListBackupsQueryDto) {
    return this.backups.list(user, query);
  }

  @Post(':id/sync-drive')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  syncDrive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.backups.syncDrive(user, id);
  }

  @Post(':id/restore')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 2, ttl: 300_000 } })
  restore(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: RestoreBackupDto,
  ) {
    return this.backups.restoreBackup(user, id, dto);
  }

  @Get(':id/status')
  @UseGuards(InternalAdminGuard)
  status(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.backups.getStatus(user, id);
  }

  @Post(':id/download-url')
  @UseGuards(SuperAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  downloadUrl(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.backups.issueDownload(user, id);
  }

  @Get(':id/download')
  @UseGuards(SuperAdminGuard)
  @Header('Cache-Control', 'no-store')
  async download(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const { stream, filename, sizeBytes } = await this.backups.streamDownload(user, id, token);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(sizeBytes));
    stream.pipe(res);
  }

  @Get(':id')
  @UseGuards(InternalAdminGuard)
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.backups.findById(user, id);
  }
}
