import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Public } from '../../common/auth/public.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { BackupConfig } from './backup-config';
import { BackupDriveAuthService } from './backup-drive-auth.service';
import { BackupDriveIntegrationService } from './backup-drive-integration.service';
import { BackupDriveService } from './backup-drive.service';

@Controller('integrations/google-drive')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class BackupDriveController {
  constructor(
    private readonly auth: BackupDriveAuthService,
    private readonly integration: BackupDriveIntegrationService,
    private readonly drive: BackupDriveService,
    private readonly backupConfig: BackupConfig,
  ) {}

  /** Start OAuth — returns Google authorization URL (Connect Drive). */
  @Get('auth-url')
  @UseGuards(SuperAdminGuard)
  connectAuthUrl(@CurrentUser() user: AuthPrincipal) {
    return this.auth.buildAuthUrl(user);
  }

  /** OAuth callback — completes Connect Drive. */
  @Public()
  @Get('callback')
  async connectCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'OAUTH_DENIED', message: error },
      });
    }

    const result = await this.auth.handleCallback(code, state);
    const successUrl = this.backupConfig.gdriveConnectSuccessUrl;
    if (successUrl) {
      const url = new URL(successUrl);
      url.searchParams.set('drive', 'connected');
      return res.redirect(url.toString());
    }

    return res.json({
      success: true,
      data: result,
    });
  }

  /** Disconnect Drive — removes encrypted credentials. */
  @Delete()
  @UseGuards(SuperAdminGuard)
  disconnect(@CurrentUser() user: AuthPrincipal) {
    return this.auth.disconnect(user);
  }

  /** Test stored connection (refresh token + folder access). */
  @Post('test')
  @UseGuards(SuperAdminGuard)
  async testConnection() {
    const refreshToken = await this.integration.getRefreshToken();
    const folderId = await this.integration.getFolderId();
    if (!refreshToken || !folderId) {
      return { ok: false, connected: false, message: 'Google Drive is not connected.' };
    }
    const result = await this.drive.testConnection(refreshToken, folderId);
    return { connected: true, ...result };
  }

  /** Connection status + sync summary for admin UI (never exposes tokens). */
  @Get('status')
  @UseGuards(SuperAdminGuard)
  status() {
    return this.integration.getAdminStatus();
  }
}
