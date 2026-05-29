import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { redactAuditState } from '../../common/audit/audit-log-redaction.util';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { readCompanyIdFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AuditLogPolicyConfig,
  type AuditLogPolicySnapshot,
} from './audit-log-policy.config';
import { ExportAuditLogsQueryDto } from './dto/export-audit-logs-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SEARCH_LENGTH = 2;
const PARTITION_NAME_RE = /^audit_logs_(\d{4})_q([1-4])$/;

export type AuditLogSummary = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  companyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditLogDetail = AuditLogSummary & {
  previousState: unknown;
  newState: unknown;
  userAgent: string | null;
};

export type AuditLogListResult = {
  items: AuditLogSummary[];
  total: number;
  totalCapped: boolean;
  limit: number;
  offset: number;
  nextCursor: string | null;
  retentionCutoffIso: string | null;
};

export type AuditLogExportResult = {
  format: 'csv' | 'json';
  rowCount: number;
  truncated: boolean;
  body: string;
  filename: string;
};

export type AuditArchivalCandidate = {
  partitionName: string;
  quarterEndIso: string;
  eligibleForArchival: boolean;
};

export type AuditArchivalReport = {
  retentionDays: number;
  retentionCutoffIso: string;
  partitions: AuditArchivalCandidate[];
  note: string;
};

type SortColumn = NonNullable<ListAuditLogsQueryDto['sort_by']>;

type QueryContext = {
  filters: Prisma.Sql;
  dateRange: { from: Date; to: Date };
  sortBy: SortColumn;
  sortDir: 'asc' | 'desc';
};

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly policy: AuditLogPolicyConfig,
    private readonly auditWriter: AuditLogService,
  ) {}

  getPolicy(): AuditLogPolicySnapshot {
    return this.policy.snapshot();
  }

  async list(user: AuthPrincipal, query: ListAuditLogsQueryDto): Promise<AuditLogListResult> {
    if (query.offset > this.policy.queryMaxOffset) {
      throw new BadRequestException(`offset may not exceed ${this.policy.queryMaxOffset}.`);
    }
    if (query.limit > this.policy.queryMaxLimit) {
      throw new BadRequestException(`limit may not exceed ${this.policy.queryMaxLimit}.`);
    }

    const ctx = this.buildQueryContext(user, query);
    const useCursor = !!query.cursor?.trim();
    if (useCursor && ctx.sortBy !== 'created_at') {
      throw new BadRequestException('cursor pagination requires sort_by=created_at.');
    }

    const orderSql = this.buildOrderClause(ctx.sortBy, ctx.sortDir);
    const cursorSql = useCursor ? this.buildCursorClause(query.cursor!, ctx.sortDir) : Prisma.empty;
    const baseFrom = Prisma.sql`
      FROM audit_logs
      WHERE ${ctx.filters}
      ${cursorSql}
    `;

    const rows = await this.prisma.$queryRaw<AuditLogRow[]>(
      Prisma.sql`
        SELECT
          id,
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          ip_address,
          created_at
        ${baseFrom}
        ${orderSql}
        LIMIT ${query.limit}
        ${useCursor ? Prisma.empty : Prisma.sql`OFFSET ${query.offset}`}
      `,
    );

    const countResult = useCursor
      ? { count: BigInt(0), capped: false }
      : await this.countCapped(baseFrom);

    const items = rows.map((row) => this.toSummary(row));
    const total = useCursor ? items.length : Number(countResult.count);
    const nextCursor =
      items.length === query.limit
        ? this.encodeCursor(items[items.length - 1]!.createdAt, items[items.length - 1]!.id)
        : null;

    return {
      items,
      total,
      totalCapped: useCursor ? false : countResult.capped,
      limit: query.limit,
      offset: useCursor ? 0 : query.offset,
      nextCursor,
      retentionCutoffIso: this.policy.retentionCutoffDate()?.toISOString() ?? null,
    };
  }

  async findById(user: AuthPrincipal, id: string): Promise<AuditLogDetail> {
    const rows = await this.prisma.$queryRaw<AuditLogDetailRow[]>(
      Prisma.sql`
        SELECT
          id,
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          previous_state,
          new_state,
          ip_address,
          user_agent,
          created_at
        FROM audit_logs
        WHERE id = ${id}::uuid
        LIMIT 1
      `,
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Audit log entry not found.');
    }

    this.assertRowVisible(user, row);
    this.assertWithinRetention(row.created_at);
    return this.toDetail(row);
  }

  async export(user: AuthPrincipal, query: ExportAuditLogsQueryDto): Promise<AuditLogExportResult> {
    if (!this.policy.exportEnabled) {
      throw new ForbiddenException('Audit export is disabled.');
    }
    if (!query.date_from?.trim() || !query.date_to?.trim()) {
      throw new BadRequestException('Export requires date_from and date_to.');
    }

    const ctx = this.buildQueryContext(user, query, {
      maxDateRangeDays: this.policy.exportMaxDateRangeDays,
    });

    const maxRows = this.policy.exportMaxRows;
    const batchSize = Math.min(100, maxRows);
    const collected: AuditLogRow[] = [];
    let cursor: string | undefined;
    let truncated = false;

    while (collected.length < maxRows) {
      const take = Math.min(batchSize, maxRows - collected.length);
      const cursorSql = cursor ? this.buildCursorClause(cursor, 'desc') : Prisma.empty;
      const batch = await this.prisma.$queryRaw<AuditLogRow[]>(
        Prisma.sql`
          SELECT
            id,
            actor_id,
            actor_email,
            actor_name,
            actor_role,
            company_id,
            action,
            resource_type,
            resource_id,
            ip_address,
            created_at
          FROM audit_logs
          WHERE ${ctx.filters}
          ${cursorSql}
          ORDER BY created_at DESC, id DESC
          LIMIT ${take}
        `,
      );

      if (batch.length === 0) break;
      collected.push(...batch);
      if (batch.length < take) break;
      if (collected.length >= maxRows) {
        truncated = true;
        break;
      }
      const last = batch[batch.length - 1]!;
      cursor = this.encodeCursor(last.created_at.toISOString(), last.id);
    }

    await this.auditWriter.log(
      this.auditWriter.fromPrincipal(user, {
        action: 'AUDIT_LOG_EXPORT',
        resourceType: 'audit_logs',
        resourceId: user.id,
        companyId: user.companyId,
        previousState: null,
        newState: {
          format: query.format,
          rowCount: collected.length,
          truncated,
          dateFrom: query.date_from,
          dateTo: query.date_to,
          companyId: query.company_id ?? null,
        },
      }),
    );

    const summaries = collected.map((row) => this.toSummary(row));
    const stamp = new Date().toISOString().slice(0, 10);

    if (query.format === 'json') {
      return {
        format: 'json',
        rowCount: summaries.length,
        truncated,
        filename: `audit-export-${stamp}.json`,
        body: JSON.stringify({ exportedAt: new Date().toISOString(), truncated, rows: summaries }),
      };
    }

    return {
      format: 'csv',
      rowCount: summaries.length,
      truncated,
      filename: `audit-export-${stamp}.csv`,
      body: this.toCsv(summaries),
    };
  }

  async getArchivalCandidates(user: AuthPrincipal): Promise<AuditArchivalReport> {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Archival preparation report requires super_admin.');
    }

    const cutoff = this.policy.retentionCutoffDate();
    if (!cutoff) {
      return {
        retentionDays: this.policy.retentionDays,
        retentionCutoffIso: '',
        partitions: [],
        note: 'Retention disabled (AUDIT_RETENTION_DAYS=0). No partitions marked for archival.',
      };
    }

    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>(
      Prisma.sql`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'audit_logs_%'
          AND tablename <> 'audit_logs_default'
        ORDER BY tablename ASC
      `,
    );

    const partitions: AuditArchivalCandidate[] = tables
      .map(({ tablename }) => {
        const end = this.partitionQuarterEnd(tablename);
        if (!end) return null;
        return {
          partitionName: tablename,
          quarterEndIso: end.toISOString(),
          eligibleForArchival: end <= cutoff,
        };
      })
      .filter((p): p is AuditArchivalCandidate => p != null);

    return {
      retentionDays: this.policy.retentionDays,
      retentionCutoffIso: cutoff.toISOString(),
      partitions,
      note:
        'Append-only table: candidates are partitions older than retention. Detach/archive via DBA runbook (no auto-delete).',
    };
  }

  private buildQueryContext(
    user: AuthPrincipal,
    query: ListAuditLogsQueryDto,
    opts?: { maxDateRangeDays?: number },
  ): QueryContext {
    const scope = this.buildTenantScope(user, query.company_id);
    if (scope.isEmpty) {
      throw new BadRequestException('No tenant scope for audit query.');
    }

    const dateRange = this.resolveDateRange(user, query, opts?.maxDateRangeDays);
    const filters = this.buildFilters(query, dateRange, scope.sql);

    return {
      filters,
      dateRange,
      sortBy: query.sort_by ?? 'created_at',
      sortDir: query.sort_dir ?? 'desc',
    };
  }

  private async countCapped(
    baseFrom: Prisma.Sql,
  ): Promise<{ count: bigint; capped: boolean }> {
    const cap = this.policy.queryCountCap;
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT 1
          ${baseFrom}
          LIMIT ${cap + 1}
        ) capped
      `,
    );
    const raw = Number(rows[0]?.count ?? 0);
    return {
      count: BigInt(Math.min(raw, cap)),
      capped: raw > cap,
    };
  }

  private buildTenantScope(
    user: AuthPrincipal,
    queryCompanyId?: string,
  ): { sql: Prisma.Sql; isEmpty: boolean } {
    const companyFilter = readCompanyIdFilter(this.companyAccess, user, queryCompanyId);

    if (companyFilter) {
      return { isEmpty: false, sql: Prisma.sql`company_id = ${companyFilter}::uuid` };
    }

    if (user.tenantScope === 'all') {
      return { isEmpty: false, sql: Prisma.sql`TRUE` };
    }

    const ids = user.authorizedCompanyIds;
    if (ids.length === 0) {
      return {
        isEmpty: false,
        sql: Prisma.sql`(company_id IS NULL AND actor_id = ${user.id}::uuid)`,
      };
    }

    if (ids.length === 1) {
      return {
        isEmpty: false,
        sql: Prisma.sql`(company_id = ${ids[0]!}::uuid OR (company_id IS NULL AND actor_id = ${user.id}::uuid))`,
      };
    }

    return {
      isEmpty: false,
      sql: Prisma.sql`(company_id = ANY(${ids}::uuid[]) OR (company_id IS NULL AND actor_id = ${user.id}::uuid))`,
    };
  }

  private resolveDateRange(
    user: AuthPrincipal,
    query: ListAuditLogsQueryDto,
    maxSpanDays = this.policy.queryMaxDateRangeDays,
  ): { from: Date; to: Date } {
    const now = new Date();
    let from = query.date_from ? new Date(`${query.date_from}T00:00:00.000Z`) : undefined;
    let to = query.date_to ? new Date(`${query.date_to}T23:59:59.999Z`) : undefined;

    const hasNarrowFilter =
      !!query.actor_id ||
      !!query.resource_id ||
      !!query.action ||
      !!query.search?.trim() ||
      !!query.company_id;

    if (!from && !to && user.tenantScope === 'all' && !hasNarrowFilter) {
      from = new Date(now.getTime() - this.policy.queryDefaultWindowDays * 86400_000);
      to = now;
    }

    if (!from && !to) {
      from = new Date(now.getTime() - this.policy.queryDefaultWindowDays * 86400_000);
      to = now;
    } else if (from && !to) {
      to = now;
    } else if (!from && to) {
      from = new Date(to.getTime() - this.policy.queryDefaultWindowDays * 86400_000);
    }

    const retentionCutoff = this.policy.retentionCutoffDate(now);
    if (retentionCutoff && from! < retentionCutoff) {
      from = retentionCutoff;
    }

    if (from! > to!) {
      throw new BadRequestException('date_from must be on or before date_to.');
    }

    const spanDays = (to!.getTime() - from!.getTime()) / 86400_000;
    if (spanDays > maxSpanDays) {
      throw new BadRequestException(`Date range may not exceed ${maxSpanDays} days.`);
    }

    return { from: from!, to: to! };
  }

  private assertWithinRetention(createdAt: Date): void {
    const cutoff = this.policy.retentionCutoffDate();
    if (cutoff && createdAt < cutoff) {
      throw new NotFoundException('Audit log entry not found.');
    }
  }

  private buildFilters(
    query: ListAuditLogsQueryDto,
    dateRange: { from: Date; to: Date },
    tenantSql: Prisma.Sql,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      tenantSql,
      Prisma.sql`created_at >= ${dateRange.from}`,
      Prisma.sql`created_at <= ${dateRange.to}`,
    ];

    if (query.actor_id) parts.push(Prisma.sql`actor_id = ${query.actor_id}::uuid`);
    if (query.actor_email?.trim()) {
      parts.push(Prisma.sql`lower(actor_email) = lower(${query.actor_email.trim()})`);
    }
    if (query.actor_role?.trim()) {
      parts.push(Prisma.sql`actor_role = ${query.actor_role.trim()}`);
    }
    if (query.resource_type?.trim()) {
      parts.push(Prisma.sql`resource_type = ${query.resource_type.trim()}`);
    }
    if (query.resource_id) parts.push(Prisma.sql`resource_id = ${query.resource_id}::uuid`);
    if (query.action?.trim()) parts.push(Prisma.sql`action = ${query.action.trim()}`);

    const search = query.search?.trim();
    if (search) {
      if (search.length < MIN_SEARCH_LENGTH) {
        throw new BadRequestException(`search must be at least ${MIN_SEARCH_LENGTH} characters.`);
      }
      const pattern = `%${this.escapeIlike(search)}%`;
      if (UUID_RE.test(search)) {
        parts.push(
          Prisma.sql`(
            resource_id = ${search}::uuid
            OR action ILIKE ${pattern} ESCAPE '\\'
            OR actor_email ILIKE ${pattern} ESCAPE '\\'
            OR actor_name ILIKE ${pattern} ESCAPE '\\'
            OR resource_type ILIKE ${pattern} ESCAPE '\\'
          )`,
        );
      } else {
        parts.push(
          Prisma.sql`(
            action ILIKE ${pattern} ESCAPE '\\'
            OR actor_email ILIKE ${pattern} ESCAPE '\\'
            OR actor_name ILIKE ${pattern} ESCAPE '\\'
            OR resource_type ILIKE ${pattern} ESCAPE '\\'
          )`,
        );
      }
    }

    return Prisma.join(parts, ' AND ');
  }

  private buildOrderClause(sortBy: SortColumn, sortDir: 'asc' | 'desc'): Prisma.Sql {
    const dir = sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    switch (sortBy) {
      case 'action':
        return Prisma.sql`ORDER BY action ${dir}, created_at DESC, id DESC`;
      case 'actor_email':
        return Prisma.sql`ORDER BY actor_email ${dir}, created_at DESC, id DESC`;
      case 'actor_role':
        return Prisma.sql`ORDER BY actor_role ${dir}, created_at DESC, id DESC`;
      case 'resource_type':
        return Prisma.sql`ORDER BY resource_type ${dir}, created_at DESC, id DESC`;
      case 'created_at':
      default:
        return Prisma.sql`ORDER BY created_at ${dir}, id ${dir}`;
    }
  }

  private buildCursorClause(cursor: string, sortDir: 'asc' | 'desc'): Prisma.Sql {
    const parsed = this.parseCursor(cursor);
    const op = sortDir === 'asc' ? Prisma.sql`>` : Prisma.sql`<`;
    return Prisma.sql`AND (created_at, id) ${op} (${parsed.createdAt}, ${parsed.id}::uuid)`;
  }

  private parseCursor(cursor: string): { id: string; createdAt: Date } {
    const trimmed = cursor.trim();
    const sep = trimmed.lastIndexOf('|');
    if (sep <= 0) throw new BadRequestException('Invalid cursor.');
    const left = trimmed.slice(0, sep);
    const id = trimmed.slice(sep + 1);
    if (!UUID_RE.test(id)) throw new BadRequestException('Invalid cursor.');
    const createdAt = new Date(left);
    if (Number.isNaN(createdAt.getTime())) throw new BadRequestException('Invalid cursor.');
    return { id, createdAt };
  }

  private encodeCursor(createdAtIso: string, id: string): string {
    return `${createdAtIso}|${id}`;
  }

  private partitionQuarterEnd(partitionName: string): Date | null {
    const m = PARTITION_NAME_RE.exec(partitionName);
    if (!m) return null;
    const year = parseInt(m[1]!, 10);
    const quarter = parseInt(m[2]!, 10);
    return new Date(Date.UTC(year, quarter * 3, 1));
  }

  private assertRowVisible(
    user: AuthPrincipal,
    row: Pick<AuditLogRow, 'company_id' | 'actor_id'>,
  ): void {
    if (row.company_id) {
      this.companyAccess.assertCompanyAccess(user, row.company_id);
      if (user.companyId && row.company_id !== user.companyId) {
        throw new NotFoundException('Audit log entry not found.');
      }
      return;
    }

    if (user.tenantScope === 'all') return;
    if (row.actor_id === user.id) return;
    throw new NotFoundException('Audit log entry not found.');
  }

  private escapeIlike(value: string): string {
    return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  }

  private toSummary(row: AuditLogRow): AuditLogSummary {
    return {
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      companyId: row.company_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      ipAddress: row.ip_address,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toDetail(row: AuditLogDetailRow): AuditLogDetail {
    return {
      ...this.toSummary(row),
      previousState: redactAuditState(row.previous_state),
      newState: redactAuditState(row.new_state),
      userAgent: row.user_agent,
    };
  }

  private toCsv(rows: AuditLogSummary[]): string {
    const header = [
      'id',
      'created_at',
      'actor_email',
      'actor_name',
      'actor_role',
      'company_id',
      'action',
      'resource_type',
      'resource_id',
      'ip_address',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.createdAt,
          r.actorEmail,
          r.actorName,
          r.actorRole,
          r.companyId ?? '',
          r.action,
          r.resourceType,
          r.resourceId,
          r.ipAddress ?? '',
        ]
          .map((v) => this.csvEscape(String(v)))
          .join(','),
      );
    }
    return lines.join('\n');
  }

  private csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_name: string;
  actor_role: string;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  created_at: Date;
};

type AuditLogDetailRow = AuditLogRow & {
  previous_state: unknown;
  new_state: unknown;
  user_agent: string | null;
};
