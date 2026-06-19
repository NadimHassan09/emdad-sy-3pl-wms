import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../auth/current-user.types';
import { TENANT_SCOPE_REQUIRED_MESSAGE } from '../auth/rbac-policy';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthorizedCompanyScope, OwnableResource, TenantScopeMode } from './company-access.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roles that may access any active client tenant once the company exists. */
const GLOBAL_TENANT_ROLES = new Set<UserRole>([
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.finance,
]);

@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build request principal tenant fields from DB memberships.
   * `requestedCompanyId` is the raw header value — validated here, not trusted.
   */
  async resolvePrincipalTenant(
    userId: string,
    role: AuthPrincipal['role'],
    requestedCompanyId?: string | null,
  ): Promise<AuthorizedCompanyScope> {
    const membership = await this.loadMembership(userId, role as UserRole);
    const requested = this.normalizeCompanyId(requestedCompanyId);

    if (requested) {
      await this.assertCompanyExists(requested);
      this.assertMembershipIncludes(membership, requested);
      return {
        ...membership,
        activeCompanyId: requested,
      };
    }

    if (membership.mode === 'restricted' && membership.companyIds.length === 1) {
      return {
        ...membership,
        activeCompanyId: membership.companyIds[0]!,
      };
    }

    return { ...membership, activeCompanyId: null };
  }

  /** Attach validated tenant scope to a base principal (JWT pipeline). */
  enrichPrincipal(
    base: Omit<AuthPrincipal, 'tenantScope' | 'authorizedCompanyIds'>,
    scope: AuthorizedCompanyScope,
  ): AuthPrincipal {
    return {
      ...base,
      companyId: scope.activeCompanyId,
      tenantScope: scope.mode,
      authorizedCompanyIds: scope.companyIds,
    };
  }

  getAuthorizedCompanyScope(user: AuthPrincipal): AuthorizedCompanyScope {
    return {
      mode: user.tenantScope,
      activeCompanyId: user.companyId,
      companyIds: [...user.authorizedCompanyIds],
    };
  }

  /**
   * Require access to a company. Uses NotFound to avoid leaking tenant existence.
   */
  assertCompanyAccess(user: AuthPrincipal, companyId: string): void {
    const id = this.normalizeCompanyId(companyId);
    if (!id) {
      throw new BadRequestException('companyId is required.');
    }
    if (user.tenantScope === 'all') {
      return;
    }
    if (!user.authorizedCompanyIds.includes(id)) {
      throw new NotFoundException('Resource not found.');
    }
  }

  assertSameCompany(user: AuthPrincipal, resourceCompanyId: string): void {
    this.assertCompanyAccess(user, resourceCompanyId);
    if (
      user.companyId &&
      resourceCompanyId !== user.companyId &&
      user.tenantScope !== 'all'
    ) {
      throw new NotFoundException('Resource not found.');
    }
  }

  validateResourceOwnership(user: AuthPrincipal, resource: OwnableResource): void {
    this.assertSameCompany(user, resource.companyId);
  }

  /**
   * Resolve company id for creates/updates: optional body value must match membership
   * and active request tenant when one is selected.
   */
  resolveWriteCompanyId(user: AuthPrincipal, bodyCompanyId?: string | null): string {
    const requested = this.normalizeCompanyId(bodyCompanyId);
    const effective = requested ?? user.companyId;
    if (!effective) {
      throw new BadRequestException(
        'companyId is required (select an authorized client tenant for this session).',
      );
    }
    this.assertCompanyAccess(user, effective);
    // Global admins may provision resources for any client; restricted sessions stay pinned.
    if (
      requested &&
      user.companyId &&
      requested !== user.companyId &&
      user.tenantScope !== 'all'
    ) {
      throw new ForbiddenException(
        'companyId does not match the active tenant for this session.',
      );
    }
    return effective;
  }

  /**
   * List/read filter: validates optional query `companyId` against memberships.
   * Returns `undefined` for global all-clients mode when no filter requested.
   */
  getReadFilterCompanyId(user: AuthPrincipal, queryCompanyId?: string): string | undefined {
    const q = this.normalizeCompanyId(queryCompanyId);
    if (q) {
      this.assertCompanyAccess(user, q);
      return q;
    }
    // Global admins with no explicit filter see all clients (ignore active X-Company-Id).
    if (user.tenantScope === 'all') {
      return undefined;
    }
    if (user.companyId) {
      return user.companyId;
    }
    return undefined;
  }

  /**
   * List/read tenant scope. Returns undefined for global admins with no explicit filter
   * (all clients). Restricted users still require a resolvable tenant.
   */
  requireReadTenantScope(user: AuthPrincipal, queryCompanyId?: string): string | undefined {
    const scoped = this.getReadFilterCompanyId(user, queryCompanyId);
    if (scoped) return scoped;
    if (user.tenantScope === 'all') {
      return undefined;
    }
    if (!user.companyId) {
      throw new BadRequestException(TENANT_SCOPE_REQUIRED_MESSAGE);
    }
    return user.companyId;
  }

  requireActiveTenant(user: AuthPrincipal, message?: string): string {
    if (!user.companyId) {
      throw new BadRequestException(
        message ?? 'An active client tenant is required for this operation.',
      );
    }
    this.assertCompanyAccess(user, user.companyId);
    return user.companyId;
  }

  private async loadMembership(
    userId: string,
    role: UserRole,
  ): Promise<Omit<AuthorizedCompanyScope, 'activeCompanyId'>> {
    if (GLOBAL_TENANT_ROLES.has(role)) {
      return { mode: 'all', companyIds: [] };
    }

    if (role === UserRole.wh_operator) {
      const [grants, worker] = await Promise.all([
        this.prisma.userCompanyAccess.findMany({
          where: { userId },
          select: { companyId: true },
        }),
        this.prisma.worker.findUnique({
          where: { userId },
          select: { companyId: true, status: true },
        }),
      ]);

      const companyIds = new Set<string>(grants.map((g) => g.companyId));
      if (worker?.status === 'active' && worker.companyId) {
        companyIds.add(worker.companyId);
      }

      return {
        mode: 'restricted',
        companyIds: [...companyIds],
      };
    }

    return { mode: 'restricted', companyIds: [] };
  }

  private assertMembershipIncludes(
    membership: Omit<AuthorizedCompanyScope, 'activeCompanyId'>,
    companyId: string,
  ): void {
    if (membership.mode === 'all') {
      return;
    }
    if (!membership.companyIds.includes(companyId)) {
      throw new ForbiddenException('You do not have access to this company.');
    }
  }

  private async assertCompanyExists(companyId: string): Promise<void> {
    const exists = await this.prisma.company.count({
      where: { id: companyId, status: 'active' },
    });
    if (!exists) {
      throw new NotFoundException('Company not found.');
    }
  }

  private normalizeCompanyId(value?: string | null): string | undefined {
    if (value == null) return undefined;
    const v = value.trim();
    if (!v) return undefined;
    if (!UUID_RE.test(v)) {
      throw new BadRequestException('companyId must be a valid UUID.');
    }
    return v.toLowerCase();
  }
}
