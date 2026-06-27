import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, Prisma, UserRole, UserStatus } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RefreshSessionService } from '../auth/refresh-session.service';

const DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

/** Orders that still represent "open" work (block archive / purge). */
const INBOUND_OPEN_STATUSES = [
  'draft',
  'pending_approval',
  'confirmed',
  'in_progress',
  'partially_received',
] as const;
const OUTBOUND_OPEN_STATUSES = [
  'draft',
  'pending_approval',
  'pending_stock',
  'confirmed',
  'picking',
  'packing',
  'ready_to_ship',
] as const;
const RETURN_OPEN_STATUSES = ['draft', 'confirmed', 'receiving', 'inspecting'] as const;
const UNRESOLVED_INVOICE_STATUSES = ['open', 'overdue'] as const;

export interface CustomerLifecycleCounts {
  products: number;
  inboundOrders: number;
  outboundOrders: number;
  returns: number;
  openInbound: number;
  openOutbound: number;
  openReturns: number;
  stockOnHand: number;
  stockRows: number;
  ledgerEntries: number;
  invoices: number;
  unresolvedInvoices: number;
  openBillingCycles: number;
  users: number;
  activeUsers: number;
  auditReferences: number;
}

export interface CustomerLifecycleContext {
  companyId: string;
  name: string;
  status: CompanyStatus;
  archivedAt: string | null;
  suspendedAt: string | null;
  purgedAt: string | null;
  retentionDays: number;
  retentionElapsedDays: number | null;
  counts: CustomerLifecycleCounts;
  flags: {
    hasStock: boolean;
    hasOpenOrders: boolean;
    hasHistory: boolean;
    isEmpty: boolean;
  };
  actions: {
    canSuspend: boolean;
    canRestore: boolean;
    canArchive: boolean;
    canHardDelete: boolean;
    canPurge: boolean;
  };
  blockers: {
    archive: string[];
    delete: string[];
    purge: string[];
  };
}

@Injectable()
export class CustomerLifecycleService {
  private readonly logger = new Logger(CustomerLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly audit: AuditLogService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly config: ConfigService,
  ) {}

  private retentionDays(): number {
    const raw = this.config.get<string | number>('CUSTOMER_PURGE_RETENTION_DAYS');
    const n = typeof raw === 'number' ? raw : raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RETENTION_DAYS;
  }

  private async getCompanyOrThrow(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  private async gatherCounts(id: string): Promise<CustomerLifecycleCounts> {
    const [
      products,
      inboundOrders,
      openInbound,
      outboundOrders,
      openOutbound,
      returns,
      openReturns,
      stockAgg,
      stockRows,
      ledgerEntries,
      invoices,
      unresolvedInvoices,
      openBillingCycles,
      users,
      activeUsers,
    ] = await Promise.all([
      this.prisma.product.count({ where: { companyId: id } }),
      this.prisma.inboundOrder.count({ where: { companyId: id } }),
      this.prisma.inboundOrder.count({
        where: { companyId: id, status: { in: [...INBOUND_OPEN_STATUSES] } },
      }),
      this.prisma.outboundOrder.count({ where: { companyId: id } }),
      this.prisma.outboundOrder.count({
        where: { companyId: id, status: { in: [...OUTBOUND_OPEN_STATUSES] } },
      }),
      this.prisma.returnOrder.count({ where: { companyId: id } }),
      this.prisma.returnOrder.count({
        where: { companyId: id, status: { in: [...RETURN_OPEN_STATUSES] } },
      }),
      this.prisma.currentStock.aggregate({
        where: { companyId: id },
        _sum: { quantityOnHand: true },
      }),
      this.prisma.currentStock.count({ where: { companyId: id } }),
      this.prisma.inventoryLedger.count({ where: { companyId: id } }),
      this.prisma.invoice.count({ where: { companyId: id } }),
      this.prisma.invoice.count({
        where: { companyId: id, status: { in: [...UNRESOLVED_INVOICE_STATUSES] } },
      }),
      this.prisma.billingCycle.count({
        where: { companyId: id, status: { in: ['active', 'renewed'] } },
      }),
      this.prisma.user.count({ where: { companyId: id } }),
      this.prisma.user.count({ where: { companyId: id, status: UserStatus.active } }),
    ]);

    let auditReferences = 0;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS c FROM audit_logs WHERE company_id = ${id}::uuid`,
      );
      auditReferences = Number(rows[0]?.c ?? 0);
    } catch (e) {
      this.logger.warn(`Could not count audit references for company ${id}: ${String(e)}`);
    }

    return {
      products,
      inboundOrders,
      outboundOrders,
      returns,
      openInbound,
      openOutbound,
      openReturns,
      stockOnHand: Number(stockAgg._sum.quantityOnHand ?? 0),
      stockRows,
      ledgerEntries,
      invoices,
      unresolvedInvoices,
      openBillingCycles,
      users,
      activeUsers,
      auditReferences,
    };
  }

  /** Full decision context used by both the API and the UI to gate actions. */
  async getContext(user: AuthPrincipal, id: string): Promise<CustomerLifecycleContext> {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    const counts = await this.gatherCounts(id);
    const retentionDays = this.retentionDays();

    const hasStock = counts.stockOnHand > 0;
    const hasOpenOrders = counts.openInbound + counts.openOutbound + counts.openReturns > 0;
    const hasHistory =
      counts.products +
        counts.inboundOrders +
        counts.outboundOrders +
        counts.returns +
        counts.stockRows +
        counts.ledgerEntries +
        counts.invoices +
        counts.users +
        counts.auditReferences >
      0;
    const isEmpty = !hasHistory;

    const archiveBlockers: string[] = [];
    if (hasStock) {
      archiveBlockers.push('This customer still owns inventory inside the warehouse.');
    }
    if (hasOpenOrders) {
      archiveBlockers.push(
        'This customer has open orders. Cancel or complete every order before archiving.',
      );
    }

    const deleteBlockers: string[] = [];
    if (!isEmpty) {
      deleteBlockers.push(
        'This customer has historical data (products, orders, inventory, billing or audit records). Permanent deletion would break referential integrity — archive instead.',
      );
    }

    const retentionElapsedDays = company.archivedAt
      ? Math.floor((Date.now() - company.archivedAt.getTime()) / DAY_MS)
      : null;

    const purgeBlockers = this.computePurgeBlockers(company, counts, retentionDays, retentionElapsedDays);

    const terminal = company.status === CompanyStatus.purged;
    const canSuspend =
      !terminal &&
      company.status !== CompanyStatus.archived &&
      company.status !== CompanyStatus.suspended;
    const canArchive =
      !terminal &&
      company.status !== CompanyStatus.archived &&
      archiveBlockers.length === 0;
    const canRestore =
      !terminal &&
      company.status !== CompanyStatus.active;
    const canHardDelete = !terminal && isEmpty;
    const canPurge = purgeBlockers.length === 0;

    return {
      companyId: company.id,
      name: company.name,
      status: company.status,
      archivedAt: company.archivedAt ? company.archivedAt.toISOString() : null,
      suspendedAt: company.suspendedAt ? company.suspendedAt.toISOString() : null,
      purgedAt: company.purgedAt ? company.purgedAt.toISOString() : null,
      retentionDays,
      retentionElapsedDays,
      counts,
      flags: { hasStock, hasOpenOrders, hasHistory, isEmpty },
      actions: { canSuspend, canRestore, canArchive, canHardDelete, canPurge },
      blockers: { archive: archiveBlockers, delete: deleteBlockers, purge: purgeBlockers },
    };
  }

  private computePurgeBlockers(
    company: { status: CompanyStatus; archivedAt: Date | null },
    counts: CustomerLifecycleCounts,
    retentionDays: number,
    retentionElapsedDays: number | null,
  ): string[] {
    const blockers: string[] = [];
    if (company.status !== CompanyStatus.archived) {
      blockers.push('Customer must be archived before it can be purged.');
    }
    if (company.status === CompanyStatus.archived) {
      if (retentionElapsedDays === null) {
        blockers.push('Archive date is missing.');
      } else if (retentionElapsedDays < retentionDays) {
        blockers.push(
          `Customer must remain archived for at least ${retentionDays} days (currently ${retentionElapsedDays}).`,
        );
      }
    }
    if (counts.stockOnHand > 0) blockers.push('Customer still owns inventory (stock > 0).');
    if (counts.openInbound > 0) blockers.push('Customer has pending inbound orders.');
    if (counts.openOutbound > 0) blockers.push('Customer has pending outbound orders.');
    if (counts.openReturns > 0) blockers.push('Customer has open return orders.');
    if (counts.activeUsers > 0) blockers.push('Customer still has active users.');
    if (counts.openBillingCycles > 0) blockers.push('Customer has open billing cycles.');
    if (counts.unresolvedInvoices > 0) {
      blockers.push('Customer has unresolved financial records (open or overdue invoices).');
    }
    return blockers;
  }

  /** Revoke every session for a company's users (immediate logout). */
  private async revokeCompanyUserSessions(companyId: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: { id: true },
    });
    for (const u of users) {
      try {
        await this.refreshSessions.invalidateUserSessions(u.id);
      } catch (e) {
        this.logger.warn(`Failed to revoke sessions for user ${u.id}: ${String(e)}`);
      }
    }
  }

  async suspend(user: AuthPrincipal, id: string, reason?: string) {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    if (company.status === CompanyStatus.purged) {
      throw new ConflictException('Purged customers cannot be modified.');
    }
    const previousStatus = company.status;
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.suspended,
        suspendedAt: new Date(),
        suspendedBy: user.id,
        suspensionReason: reason?.trim() || null,
      },
    });
    await this.revokeCompanyUserSessions(id);
    await this.audit.logBestEffort(
      this.audit.fromPrincipal(user, {
        action: 'customer.suspended',
        resourceType: 'company',
        resourceId: id,
        companyId: id,
        previousState: { status: previousStatus },
        newState: { status: updated.status, reason: reason?.trim() || null },
      }),
    );
    return updated;
  }

  async archive(user: AuthPrincipal, id: string, reason?: string) {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    if (company.status === CompanyStatus.purged) {
      throw new ConflictException('Purged customers cannot be modified.');
    }
    const counts = await this.gatherCounts(id);
    if (counts.stockOnHand > 0) {
      throw new BadRequestException('This customer still owns inventory inside the warehouse.');
    }
    if (counts.openInbound + counts.openOutbound + counts.openReturns > 0) {
      throw new BadRequestException(
        'This customer has open orders. Cancel or complete every order before archiving.',
      );
    }
    const previousStatus = company.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Disable all client users so the account becomes a read-only historical record.
      await tx.user.updateMany({
        where: { companyId: id, status: UserStatus.active },
        data: { status: UserStatus.inactive },
      });
      return tx.company.update({
        where: { id },
        data: {
          status: CompanyStatus.archived,
          archivedAt: new Date(),
          archivedBy: user.id,
          archiveReason: reason?.trim() || null,
        },
      });
    });
    await this.revokeCompanyUserSessions(id);
    await this.audit.logBestEffort(
      this.audit.fromPrincipal(user, {
        action: 'customer.archived',
        resourceType: 'company',
        resourceId: id,
        companyId: id,
        previousState: { status: previousStatus },
        newState: { status: updated.status, reason: reason?.trim() || null },
      }),
    );
    return updated;
  }

  async restore(user: AuthPrincipal, id: string, reason?: string) {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    if (company.status === CompanyStatus.purged) {
      throw new ConflictException('Purged customers cannot be restored.');
    }
    if (company.status === CompanyStatus.active) {
      throw new ConflictException('Customer is already active.');
    }
    const previousStatus = company.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Re-enable users that were disabled during archive.
      await tx.user.updateMany({
        where: { companyId: id, status: UserStatus.inactive },
        data: { status: UserStatus.active },
      });
      return tx.company.update({
        where: { id },
        data: {
          status: CompanyStatus.active,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          archivedAt: null,
          archivedBy: null,
          archiveReason: null,
        },
      });
    });
    await this.audit.logBestEffort(
      this.audit.fromPrincipal(user, {
        action: 'customer.restored',
        resourceType: 'company',
        resourceId: id,
        companyId: id,
        previousState: { status: previousStatus },
        newState: { status: updated.status, reason: reason?.trim() || null },
      }),
    );
    return updated;
  }

  /**
   * Scenario 1 — hard delete a customer that has zero references anywhere.
   * Safe because there are no foreign keys to break.
   */
  async hardDelete(user: AuthPrincipal, id: string) {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    const counts = await this.gatherCounts(id);
    const isEmpty =
      counts.products +
        counts.inboundOrders +
        counts.outboundOrders +
        counts.returns +
        counts.stockRows +
        counts.ledgerEntries +
        counts.invoices +
        counts.users +
        counts.auditReferences ===
      0;
    if (!isEmpty) {
      throw new ConflictException(
        'This customer has historical data and cannot be permanently deleted. Archive it instead.',
      );
    }
    try {
      await this.prisma.company.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'This customer has related data and was not deleted. Archive it instead.',
        );
      }
      throw e;
    }
    await this.audit.logBestEffort(
      this.audit.fromPrincipal(user, {
        action: 'customer.deleted',
        resourceType: 'company',
        resourceId: id,
        companyId: null,
        previousState: { status: company.status, name: company.name },
        newState: { deleted: true },
      }),
    );
    return { id, deleted: true as const };
  }

  /**
   * Permanent purge (Super Admin only). Generates a full archive export, then either
   * hard-deletes an empty customer or anonymizes a customer that has history so that
   * NO foreign keys are ever broken. Transactional records are preserved for reports,
   * billing history, audit logs and inventory history.
   */
  async purge(user: AuthPrincipal, id: string) {
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('Only a super administrator can purge customers.');
    }
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.getCompanyOrThrow(id);
    const counts = await this.gatherCounts(id);
    const retentionDays = this.retentionDays();
    const retentionElapsedDays = company.archivedAt
      ? Math.floor((Date.now() - company.archivedAt.getTime()) / DAY_MS)
      : null;
    const blockers = this.computePurgeBlockers(company, counts, retentionDays, retentionElapsedDays);
    if (blockers.length > 0) {
      throw new ConflictException(
        `This customer is not eligible for permanent purge: ${blockers.join(' ')}`,
      );
    }

    const exportPath = await this.generateArchiveExport(company, counts);

    const isEmpty =
      counts.products +
        counts.inboundOrders +
        counts.outboundOrders +
        counts.returns +
        counts.stockRows +
        counts.ledgerEntries +
        counts.invoices +
        counts.users +
        counts.auditReferences ===
      0;

    let mode: 'deleted' | 'anonymized';
    if (isEmpty) {
      await this.prisma.company.delete({ where: { id } });
      mode = 'deleted';
    } else {
      // Anonymize in place: scrub PII, keep the row + every FK intact.
      const shortId = id.slice(0, 8);
      await this.prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { companyId: id },
          data: { status: UserStatus.inactive },
        });
        await tx.company.update({
          where: { id },
          data: {
            name: `[PURGED ${shortId}]`,
            tradeName: null,
            contactEmail: `purged+${shortId}@purged.local`,
            contactPhone: null,
            address: null,
            city: null,
            vatNumber: null,
            notes: null,
            status: CompanyStatus.purged,
            purgedAt: new Date(),
          },
        });
      });
      mode = 'anonymized';
    }

    await this.audit.logBestEffort(
      this.audit.fromPrincipal(user, {
        action: 'customer.purged',
        resourceType: 'company',
        resourceId: id,
        companyId: mode === 'deleted' ? null : id,
        previousState: { status: company.status, name: company.name },
        newState: { mode, exportPath, counts },
      }),
    );

    return { id, purged: true as const, mode, exportPath };
  }

  /** Best-effort full archive export written to disk before purge. */
  private async generateArchiveExport(
    company: { id: string; name: string; status: CompanyStatus; archivedAt: Date | null },
    counts: CustomerLifecycleCounts,
  ): Promise<string | null> {
    try {
      const dir = path.join(process.cwd(), 'storage', 'customer-archives');
      await fs.mkdir(dir, { recursive: true });
      const [products, inbound, outbound, invoices] = await Promise.all([
        this.prisma.product.findMany({ where: { companyId: company.id } }),
        this.prisma.inboundOrder.findMany({ where: { companyId: company.id } }),
        this.prisma.outboundOrder.findMany({ where: { companyId: company.id } }),
        this.prisma.invoice.findMany({ where: { companyId: company.id } }),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        company,
        counts,
        records: { products, inbound, outbound, invoices },
      };
      const file = path.join(dir, `${company.id}-${Date.now()}.json`);
      await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
      return file;
    } catch (e) {
      this.logger.warn(`Archive export failed for company ${company.id}: ${String(e)}`);
      return null;
    }
  }
}
