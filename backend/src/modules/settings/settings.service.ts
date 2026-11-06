import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsertGoogleOAuthDto } from './dto/upsert-google-oauth.dto';

export interface GoogleOAuthView {
  hasClientId: boolean;
  clientIdPreview: string | null;
  hasClientSecret: boolean;
  redirectUri: string | null;
  lastTestAt: string | null;
  lastTestStatus: 'ok' | 'error' | null;
  lastTestError: string | null;
  updatedAt: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getGoogleOAuth(): Promise<GoogleOAuthView> {
    const row = await this.prisma.googleOAuthSettings.findUnique({ where: { id: 'default' } });
    if (!row) {
      return {
        hasClientId: false,
        clientIdPreview: null,
        hasClientSecret: false,
        redirectUri: null,
        lastTestAt: null,
        lastTestStatus: null,
        lastTestError: null,
        updatedAt: new Date().toISOString(),
      };
    }
    let clientIdPreview: string | null = null;
    if (row.encryptedClientId) {
      try {
        const plain = this.encryption.decrypt(row.encryptedClientId);
        // Show only the first 12 characters then ****
        clientIdPreview = plain.length > 12 ? plain.slice(0, 12) + '****' : plain;
      } catch {
        clientIdPreview = '****';
      }
    }
    return {
      hasClientId: !!row.encryptedClientId,
      clientIdPreview,
      hasClientSecret: !!row.encryptedClientSecret,
      redirectUri: row.redirectUri ?? null,
      lastTestAt: row.lastTestAt?.toISOString() ?? null,
      lastTestStatus: (row.lastTestStatus as 'ok' | 'error' | null) ?? null,
      lastTestError: row.lastTestError ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsertGoogleOAuth(
    userId: string,
    dto: UpsertGoogleOAuthDto,
  ): Promise<GoogleOAuthView> {
    const existing = await this.prisma.googleOAuthSettings.findUnique({ where: { id: 'default' } });

    let encryptedClientId = existing?.encryptedClientId ?? undefined;
    if (dto.clientId !== undefined) {
      encryptedClientId = dto.clientId.trim()
        ? this.encryption.encrypt(dto.clientId.trim())
        : undefined;
    }

    let encryptedClientSecret = existing?.encryptedClientSecret ?? undefined;
    if (dto.clientSecret !== undefined) {
      encryptedClientSecret = dto.clientSecret.trim()
        ? this.encryption.encrypt(dto.clientSecret.trim())
        : undefined;
    }

    await this.prisma.googleOAuthSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        encryptedClientId: encryptedClientId ?? null,
        encryptedClientSecret: encryptedClientSecret ?? null,
        redirectUri: dto.redirectUri ?? null,
        updatedByUserId: userId,
      },
      update: {
        ...(dto.clientId !== undefined ? { encryptedClientId: encryptedClientId ?? null } : {}),
        ...(dto.clientSecret !== undefined ? { encryptedClientSecret: encryptedClientSecret ?? null } : {}),
        ...(dto.redirectUri !== undefined ? { redirectUri: dto.redirectUri } : {}),
        updatedByUserId: userId,
      },
    });
    return this.getGoogleOAuth();
  }

  async testGoogleOAuth(): Promise<GoogleOAuthView> {
    const row = await this.prisma.googleOAuthSettings.findUnique({ where: { id: 'default' } });
    let status: 'ok' | 'error' = 'error';
    let error: string | null = null;

    if (!row?.encryptedClientId || !row?.encryptedClientSecret) {
      error = 'Client ID and Client Secret must be saved before testing.';
    } else {
      try {
        const clientId = this.encryption.decrypt(row.encryptedClientId);
        // Validate clientId format: Google OAuth clientIds end with .apps.googleusercontent.com
        if (!clientId.endsWith('.apps.googleusercontent.com')) {
          error = 'Client ID does not look like a Google OAuth client ID (should end with .apps.googleusercontent.com).';
        } else {
          // Ping Google's OAuth token endpoint to check the clientId is recognized.
          // A bad clientId returns 400, a good one (with wrong params) returns 400 too but with a different error_description.
          const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: row.redirectUri ?? 'https://example.com',
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/drive.file',
            access_type: 'offline',
          });
          const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
          const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
          // Google redirects (302/303) with valid clientId, or returns 400 for invalid ones
          if (res.status === 302 || res.status === 303 || res.status === 200) {
            status = 'ok';
          } else if (res.status === 400) {
            error = 'Google rejected the Client ID (HTTP 400). Check that it is correct and the OAuth consent screen is configured.';
          } else {
            status = 'ok'; // unexpected status but no clear error — treat as ok
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Could not reach Google authentication servers.';
      }
    }

    await this.prisma.googleOAuthSettings.update({
      where: { id: 'default' },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: status,
        lastTestError: error,
      },
    });
    return this.getGoogleOAuth();
  }

  /** Decrypt and return credentials for use by the OAuth callback handler. */
  async getDecryptedCredentials(): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
    const row = await this.prisma.googleOAuthSettings.findUnique({ where: { id: 'default' } });
    if (!row?.encryptedClientId || !row?.encryptedClientSecret || !row?.redirectUri) return null;
    try {
      return {
        clientId: this.encryption.decrypt(row.encryptedClientId),
        clientSecret: this.encryption.decrypt(row.encryptedClientSecret),
        redirectUri: row.redirectUri,
      };
    } catch {
      return null;
    }
  }
}
