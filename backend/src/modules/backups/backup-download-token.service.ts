import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

import { BackupConfig } from './backup-config';

type TokenPayload = {
  jobId: string;
  userId: string;
  exp: number;
};

@Injectable()
export class BackupDownloadTokenService {
  constructor(private readonly backupConfig: BackupConfig) {}

  issue(jobId: string, userId: string): { token: string; expiresAt: string; expiresInSec: number } {
    const ttl = this.backupConfig.downloadTokenTtlSec;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const token = this.sign({ jobId, userId, exp });
    return {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      expiresInSec: ttl,
    };
  }

  verify(token: string, jobId: string, userId: string): void {
    const payload = this.parseAndVerify(token);
    if (payload.jobId !== jobId || payload.userId !== userId) {
      throw new UnauthorizedException('Invalid download token.');
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Download token has expired.');
    }
  }

  buildDownloadUrl(jobId: string, token: string, apiBasePath = '/api'): string {
    const q = new URLSearchParams({ token });
    return `${apiBasePath}/backups/${jobId}/download?${q.toString()}`;
  }

  private sign(payload: TokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.backupConfig.signingSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  private parseAndVerify(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid download token.');
    }
    const [body, sig] = parts;
    const expected = createHmac('sha256', this.backupConfig.signingSecret)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid download token.');
    }
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid download token.');
    }
  }
}
