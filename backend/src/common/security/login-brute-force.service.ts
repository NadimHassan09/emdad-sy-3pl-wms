import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service';

export type LoginPortal = 'internal' | 'client';

export type LoginAttemptContext = {
  email?: string;
  userAgent?: string | null;
  ipAddress: string;
};

const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;

type Bucket = { failures: number[] };

@Injectable()
export class LoginBruteForceService {
  /** `${portal}:${ip}` → rolling failure timestamps (ms). */
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly audit: AuditLogService) {}

  assertAllowed(portal: LoginPortal, ip: string): void {
    if (this.failureCount(portal, ip) >= MAX_FAILURES) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message:
            'Too many failed sign-in attempts. Please wait about a minute before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Records a failed credential check; returns true when the IP is now rate-limited. */
  recordFailure(portal: LoginPortal, ctx: LoginAttemptContext): boolean {
    const key = this.key(portal, ctx.ipAddress);
    const now = Date.now();
    const bucket = this.pruneBucket(key, now);
    bucket.failures.push(now);
    this.buckets.set(key, bucket);
    const blocked = bucket.failures.length >= MAX_FAILURES;
    if (blocked) {
      void this.audit.logBestEffort({
        actorId: null,
        actorEmail: ctx.email?.trim().toLowerCase() ?? 'anonymous',
        actorName: 'Login rate limit',
        actorRole: 'anonymous',
        companyId: null,
        action: 'SECURITY_LOGIN_RATE_LIMITED',
        resourceType: 'security',
        resourceId: ctx.ipAddress,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent ?? null,
        newState: {
          portal,
          failures: bucket.failures.length,
          windowSec: WINDOW_MS / 1000,
          email: ctx.email?.trim().toLowerCase() ?? null,
        },
      });
    }
    return blocked;
  }

  recordSuccess(portal: LoginPortal, ip: string): void {
    this.buckets.delete(this.key(portal, ip));
  }

  /** Used by tests and ops diagnostics. */
  failureCount(portal: LoginPortal, ip: string): number {
    return this.pruneBucket(this.key(portal, ip), Date.now()).failures.length;
  }

  reset(portal?: LoginPortal, ip?: string): void {
    if (!portal) {
      this.buckets.clear();
      return;
    }
    if (!ip) {
      for (const key of [...this.buckets.keys()]) {
        if (key.startsWith(`${portal}:`)) this.buckets.delete(key);
      }
      return;
    }
    this.buckets.delete(this.key(portal, ip));
  }

  private key(portal: LoginPortal, ip: string): string {
    return `${portal}:${ip || 'unknown'}`;
  }

  private pruneBucket(key: string, now: number): Bucket {
    const existing = this.buckets.get(key);
    const cutoff = now - WINDOW_MS;
    const failures = (existing?.failures ?? []).filter((ts) => ts > cutoff);
    const bucket = { failures };
    if (failures.length === 0) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, bucket);
    }
    return bucket;
  }
}
