import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCredentialScope, CompanyStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseApiCredentials, verifyApiSecret } from '../api-credentials/api-credential.util';
import { API_SCOPE_KEY } from './require-api-scope.decorator';

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 20;
const LAST_USED_MIN_INTERVAL_MS = 60_000;

type AuthedRequest = Request & {
  user?: ClientPrincipal;
  apiCredential?: { id: string; scope: ApiCredentialScope; companyId: string };
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const parsed = parseApiCredentials({
      apiKeyHeader: req.headers['x-api-key'],
      apiSecretHeader: req.headers['x-api-secret'],
      authorization: req.headers.authorization,
    });
    if (!parsed) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Provide X-API-Key and X-API-Secret (or Authorization: Bearer <API_KEY>:<API_SECRET>).',
      });
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const failKey = `${parsed.apiKey}::${ip}`;
    this.assertNotLocked(failKey);

    const credential = await this.prisma.apiCredential.findUnique({
      where: { apiKey: parsed.apiKey },
      include: {
        company: { select: { id: true, name: true, status: true } },
        creator: { select: { id: true, email: true, fullName: true, status: true, role: true } },
      },
    });

    const secretOk = credential ? verifyApiSecret(parsed.apiSecret, credential.secretHash) : false;
    if (!credential || !secretOk) {
      this.recordFailure(failKey);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid API credentials.',
      });
    }
    this.failures.delete(failKey);

    if (credential.revokedAt) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This API key has been revoked.' });
    }
    if (!credential.isActive) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This API key is disabled.' });
    }
    if (credential.company.status !== CompanyStatus.active) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Company is not active for API access.',
      });
    }

    const requiredScope = this.reflector.getAllAndOverride<ApiCredentialScope>(API_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScope && credential.scope !== requiredScope) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `This API key is scoped to ${credential.scope} and cannot call ${requiredScope} endpoints.`,
      });
    }

    type Actor = {
      id: string;
      email: string;
      fullName: string;
      status: UserStatus;
      role: string;
    };
    let actor: Actor | null = credential.creator;
    if (!actor || actor.status !== UserStatus.active) {
      actor = await this.prisma.user.findFirst({
        where: {
          companyId: credential.companyId,
          status: UserStatus.active,
          role: { in: ['client_admin', 'client_staff'] },
        },
        select: { id: true, email: true, fullName: true, status: true, role: true },
      });
    }
    if (!actor) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No active client user is available to own API-created orders.',
      });
    }

    const role = actor.role === 'client_staff' ? 'client_staff' : 'client_admin';
    req.user = {
      id: actor.id,
      email: actor.email,
      fullName: actor.fullName,
      role,
      companyId: credential.companyId,
      companyName: credential.company.name,
      tenantScope: 'restricted',
      authorizedCompanyIds: [credential.companyId],
    } as unknown as AuthedRequest['user'];
    req.apiCredential = {
      id: credential.id,
      scope: credential.scope,
      companyId: credential.companyId,
    };

    void this.touchLastUsed(credential.id, credential.lastUsedAt);
    return true;
  }

  private assertNotLocked(failKey: string): void {
    const row = this.failures.get(failKey);
    if (!row) return;
    if (Date.now() > row.resetAt) {
      this.failures.delete(failKey);
      return;
    }
    if (row.count >= FAIL_LIMIT) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many invalid API credential attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(failKey: string): void {
    const now = Date.now();
    const row = this.failures.get(failKey);
    if (!row || now > row.resetAt) {
      this.failures.set(failKey, { count: 1, resetAt: now + FAIL_WINDOW_MS });
      return;
    }
    row.count += 1;
  }

  private async touchLastUsed(id: string, lastUsedAt: Date | null): Promise<void> {
    if (lastUsedAt && Date.now() - lastUsedAt.getTime() < LAST_USED_MIN_INTERVAL_MS) return;
    try {
      await this.prisma.apiCredential.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Usage timestamp is best-effort.
    }
  }
}
