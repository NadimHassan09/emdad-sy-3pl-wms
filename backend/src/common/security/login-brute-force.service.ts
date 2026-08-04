import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service';

export type LoginPortal = 'internal' | 'client';

export type LoginAttemptContext = {
  email?: string;
  userAgent?: string | null;
  ipAddress: string;
};

/**
 * Login attempt tracker — lockout is permanently disabled.
 * Methods remain as no-ops so auth call sites stay unchanged.
 */
@Injectable()
export class LoginBruteForceService {
  private readonly log = new Logger(LoginBruteForceService.name);

  constructor(_audit: AuditLogService) {
    this.log.warn('Login brute-force lockout is permanently DISABLED.');
  }

  assertAllowed(_portal: LoginPortal, _ip: string): void {
    /* lockout removed */
  }

  recordFailure(_portal: LoginPortal, _ctx: LoginAttemptContext): boolean {
    return false;
  }

  recordSuccess(_portal: LoginPortal, _ip: string): void {
    /* no-op */
  }

  failureCount(_portal: LoginPortal, _ip: string): number {
    return 0;
  }

  reset(_portal?: LoginPortal, _ip?: string): void {
    /* no-op */
  }
}
