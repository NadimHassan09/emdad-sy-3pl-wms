import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { isInternalAdminRole } from '../../common/auth/rbac-policy';
import { OpsPolicyConfig } from './ops-policy.config';

/**
 * Protects readiness when `OPS_PROBE_SECRET` is configured in production.
 * Accepts `X-Ops-Probe-Key` (internal LB/k8s) or an authenticated internal-admin JWT.
 */
@Injectable()
export class OpsProbeGuard implements CanActivate {
  constructor(private readonly policy: OpsPolicyConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.policy.readinessRequiresProbeKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthPrincipal;
    }>();

    const user = req.user;
    if (user && isInternalAdminRole(user.role)) {
      return true;
    }

    const provided = this.headerValue(req.headers['x-ops-probe-key']);
    const expected = this.policy.probeSecret;
    if (provided && expected && this.safeEqual(provided, expected)) {
      return true;
    }

    throw new ForbiddenException('Operational readiness probe requires a valid X-Ops-Probe-Key.');
  }

  private headerValue(value: string | string[] | undefined): string | null {
    if (!value) return null;
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = raw?.trim();
    return trimmed || null;
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
