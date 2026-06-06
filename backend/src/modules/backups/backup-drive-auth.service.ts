import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupDriveIntegrationService } from './backup-drive-integration.service';
import { BackupDriveService } from './backup-drive.service';

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
};

@Injectable()
export class BackupDriveAuthService {
  constructor(
    private readonly backupConfig: BackupConfig,
    private readonly integration: BackupDriveIntegrationService,
    private readonly drive: BackupDriveService,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  buildAuthUrl(user: AuthPrincipal): { url: string; state: string } {
    this.assertConfigured();
    const state = this.signState({
      userId: user.id,
      nonce: randomBytes(16).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + 600,
    });

    const params = new URLSearchParams({
      client_id: this.backupConfig.gdriveClientId!,
      redirect_uri: this.backupConfig.gdriveRedirectUri!,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/drive.file',
      state,
    });

    return {
      state,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  async handleCallback(code: string | undefined, state: string | undefined): Promise<{
    connected: boolean;
    folderId: string;
    connectedByUserId: string;
  }> {
    this.assertConfigured();
    if (!code?.trim()) throw new BadRequestException('Missing OAuth authorization code.');
    if (!state?.trim()) throw new BadRequestException('Missing OAuth state.');

    const payload = this.verifyState(state);
    const tokens = await this.drive.exchangeCodeForTokens(code.trim());
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Re-authorize with prompt=consent.',
      );
    }

    const folderId = await this.drive.ensureRootFolder(tokens.refresh_token);
    await this.integration.saveConnection({
      refreshToken: tokens.refresh_token,
      folderId,
      connectedByUserId: payload.userId,
    });

    const actor = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, companyId: true, fullName: true },
    });
    if (actor) {
      await this.audit.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.fullName,
        actorRole: actor.role,
        companyId: actor.companyId,
        action: 'backup.drive.connected',
        resourceType: 'backup_drive_integration',
        resourceId: folderId,
        newState: {
          message: `${actor.email} connected Google Drive for backup storage`,
          folderId,
        },
      });
    }

    return {
      connected: true,
      folderId,
      connectedByUserId: payload.userId,
    };
  }

  async disconnect(user: AuthPrincipal): Promise<{ disconnected: boolean }> {
    const hadConnection = await this.integration.disconnect();
    if (hadConnection) {
      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: 'backup.drive.disconnected',
          resourceType: 'backup_drive_integration',
          resourceId: 'google_drive',
          newState: {
            message: `${user.email ?? user.id} disconnected Google Drive`,
          },
        }),
      );
    }
    return { disconnected: hadConnection };
  }

  private assertConfigured(): void {
    if (!this.backupConfig.gdriveConfigured()) {
      throw new ServiceUnavailableException(
        'Google Drive integration is not configured (BACKUP_GDRIVE_ENABLED and OAuth env vars).',
      );
    }
  }

  private signState(payload: OAuthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.backupConfig.signingSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const parts = state.split('.');
    if (parts.length !== 2) throw new BadRequestException('Invalid OAuth state.');
    const [body, sig] = parts;
    const expected = createHmac('sha256', this.backupConfig.signingSecret)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid OAuth state signature.');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('OAuth state has expired.');
    }
    return payload;
  }
}
