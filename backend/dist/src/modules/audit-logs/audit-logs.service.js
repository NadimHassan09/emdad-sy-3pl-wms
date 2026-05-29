"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_redaction_util_1 = require("../../common/audit/audit-log-redaction.util");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_log_policy_config_1 = require("./audit-log-policy.config");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SEARCH_LENGTH = 2;
const PARTITION_NAME_RE = /^audit_logs_(\d{4})_q([1-4])$/;
let AuditLogsService = class AuditLogsService {
    prisma;
    companyAccess;
    policy;
    auditWriter;
    constructor(prisma, companyAccess, policy, auditWriter) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.policy = policy;
        this.auditWriter = auditWriter;
    }
    getPolicy() {
        return this.policy.snapshot();
    }
    async list(user, query) {
        if (query.offset > this.policy.queryMaxOffset) {
            throw new common_1.BadRequestException(`offset may not exceed ${this.policy.queryMaxOffset}.`);
        }
        if (query.limit > this.policy.queryMaxLimit) {
            throw new common_1.BadRequestException(`limit may not exceed ${this.policy.queryMaxLimit}.`);
        }
        const ctx = this.buildQueryContext(user, query);
        const useCursor = !!query.cursor?.trim();
        if (useCursor && ctx.sortBy !== 'created_at') {
            throw new common_1.BadRequestException('cursor pagination requires sort_by=created_at.');
        }
        const orderSql = this.buildOrderClause(ctx.sortBy, ctx.sortDir);
        const cursorSql = useCursor ? this.buildCursorClause(query.cursor, ctx.sortDir) : client_1.Prisma.empty;
        const baseFrom = client_1.Prisma.sql `
      FROM audit_logs
      WHERE ${ctx.filters}
      ${cursorSql}
    `;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
        ${useCursor ? client_1.Prisma.empty : client_1.Prisma.sql `OFFSET ${query.offset}`}
      `);
        const countResult = useCursor
            ? { count: BigInt(0), capped: false }
            : await this.countCapped(baseFrom);
        const items = rows.map((row) => this.toSummary(row));
        const total = useCursor ? items.length : Number(countResult.count);
        const nextCursor = items.length === query.limit
            ? this.encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
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
    async findById(user, id) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
      `);
        const row = rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Audit log entry not found.');
        }
        this.assertRowVisible(user, row);
        this.assertWithinRetention(row.created_at);
        return this.toDetail(row);
    }
    async export(user, query) {
        if (!this.policy.exportEnabled) {
            throw new common_1.ForbiddenException('Audit export is disabled.');
        }
        if (!query.date_from?.trim() || !query.date_to?.trim()) {
            throw new common_1.BadRequestException('Export requires date_from and date_to.');
        }
        const ctx = this.buildQueryContext(user, query, {
            maxDateRangeDays: this.policy.exportMaxDateRangeDays,
        });
        const maxRows = this.policy.exportMaxRows;
        const batchSize = Math.min(100, maxRows);
        const collected = [];
        let cursor;
        let truncated = false;
        while (collected.length < maxRows) {
            const take = Math.min(batchSize, maxRows - collected.length);
            const cursorSql = cursor ? this.buildCursorClause(cursor, 'desc') : client_1.Prisma.empty;
            const batch = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
        `);
            if (batch.length === 0)
                break;
            collected.push(...batch);
            if (batch.length < take)
                break;
            if (collected.length >= maxRows) {
                truncated = true;
                break;
            }
            const last = batch[batch.length - 1];
            cursor = this.encodeCursor(last.created_at.toISOString(), last.id);
        }
        await this.auditWriter.log(this.auditWriter.fromPrincipal(user, {
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
        }));
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
    async getArchivalCandidates(user) {
        if (user.role !== 'super_admin') {
            throw new common_1.ForbiddenException('Archival preparation report requires super_admin.');
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
        const tables = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'audit_logs_%'
          AND tablename <> 'audit_logs_default'
        ORDER BY tablename ASC
      `);
        const partitions = tables
            .map(({ tablename }) => {
            const end = this.partitionQuarterEnd(tablename);
            if (!end)
                return null;
            return {
                partitionName: tablename,
                quarterEndIso: end.toISOString(),
                eligibleForArchival: end <= cutoff,
            };
        })
            .filter((p) => p != null);
        return {
            retentionDays: this.policy.retentionDays,
            retentionCutoffIso: cutoff.toISOString(),
            partitions,
            note: 'Append-only table: candidates are partitions older than retention. Detach/archive via DBA runbook (no auto-delete).',
        };
    }
    buildQueryContext(user, query, opts) {
        const scope = this.buildTenantScope(user, query.company_id);
        if (scope.isEmpty) {
            throw new common_1.BadRequestException('No tenant scope for audit query.');
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
    async countCapped(baseFrom) {
        const cap = this.policy.queryCountCap;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT 1
          ${baseFrom}
          LIMIT ${cap + 1}
        ) capped
      `);
        const raw = Number(rows[0]?.count ?? 0);
        return {
            count: BigInt(Math.min(raw, cap)),
            capped: raw > cap,
        };
    }
    buildTenantScope(user, queryCompanyId) {
        const companyFilter = (0, company_read_scope_1.readCompanyIdFilter)(this.companyAccess, user, queryCompanyId);
        if (companyFilter) {
            return { isEmpty: false, sql: client_1.Prisma.sql `company_id = ${companyFilter}::uuid` };
        }
        if (user.tenantScope === 'all') {
            return { isEmpty: false, sql: client_1.Prisma.sql `TRUE` };
        }
        const ids = user.authorizedCompanyIds;
        if (ids.length === 0) {
            return {
                isEmpty: false,
                sql: client_1.Prisma.sql `(company_id IS NULL AND actor_id = ${user.id}::uuid)`,
            };
        }
        if (ids.length === 1) {
            return {
                isEmpty: false,
                sql: client_1.Prisma.sql `(company_id = ${ids[0]}::uuid OR (company_id IS NULL AND actor_id = ${user.id}::uuid))`,
            };
        }
        return {
            isEmpty: false,
            sql: client_1.Prisma.sql `(company_id = ANY(${ids}::uuid[]) OR (company_id IS NULL AND actor_id = ${user.id}::uuid))`,
        };
    }
    resolveDateRange(user, query, maxSpanDays = this.policy.queryMaxDateRangeDays) {
        const now = new Date();
        let from = query.date_from ? new Date(`${query.date_from}T00:00:00.000Z`) : undefined;
        let to = query.date_to ? new Date(`${query.date_to}T23:59:59.999Z`) : undefined;
        const hasNarrowFilter = !!query.actor_id ||
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
        }
        else if (from && !to) {
            to = now;
        }
        else if (!from && to) {
            from = new Date(to.getTime() - this.policy.queryDefaultWindowDays * 86400_000);
        }
        const retentionCutoff = this.policy.retentionCutoffDate(now);
        if (retentionCutoff && from < retentionCutoff) {
            from = retentionCutoff;
        }
        if (from > to) {
            throw new common_1.BadRequestException('date_from must be on or before date_to.');
        }
        const spanDays = (to.getTime() - from.getTime()) / 86400_000;
        if (spanDays > maxSpanDays) {
            throw new common_1.BadRequestException(`Date range may not exceed ${maxSpanDays} days.`);
        }
        return { from: from, to: to };
    }
    assertWithinRetention(createdAt) {
        const cutoff = this.policy.retentionCutoffDate();
        if (cutoff && createdAt < cutoff) {
            throw new common_1.NotFoundException('Audit log entry not found.');
        }
    }
    buildFilters(query, dateRange, tenantSql) {
        const parts = [
            tenantSql,
            client_1.Prisma.sql `created_at >= ${dateRange.from}`,
            client_1.Prisma.sql `created_at <= ${dateRange.to}`,
        ];
        if (query.actor_id)
            parts.push(client_1.Prisma.sql `actor_id = ${query.actor_id}::uuid`);
        if (query.actor_email?.trim()) {
            parts.push(client_1.Prisma.sql `lower(actor_email) = lower(${query.actor_email.trim()})`);
        }
        if (query.actor_role?.trim()) {
            parts.push(client_1.Prisma.sql `actor_role = ${query.actor_role.trim()}`);
        }
        if (query.resource_type?.trim()) {
            parts.push(client_1.Prisma.sql `resource_type = ${query.resource_type.trim()}`);
        }
        if (query.resource_id)
            parts.push(client_1.Prisma.sql `resource_id = ${query.resource_id}::uuid`);
        if (query.action?.trim())
            parts.push(client_1.Prisma.sql `action = ${query.action.trim()}`);
        const search = query.search?.trim();
        if (search) {
            if (search.length < MIN_SEARCH_LENGTH) {
                throw new common_1.BadRequestException(`search must be at least ${MIN_SEARCH_LENGTH} characters.`);
            }
            const pattern = `%${this.escapeIlike(search)}%`;
            if (UUID_RE.test(search)) {
                parts.push(client_1.Prisma.sql `(
            resource_id = ${search}::uuid
            OR action ILIKE ${pattern} ESCAPE '\\'
            OR actor_email ILIKE ${pattern} ESCAPE '\\'
            OR actor_name ILIKE ${pattern} ESCAPE '\\'
            OR resource_type ILIKE ${pattern} ESCAPE '\\'
          )`);
            }
            else {
                parts.push(client_1.Prisma.sql `(
            action ILIKE ${pattern} ESCAPE '\\'
            OR actor_email ILIKE ${pattern} ESCAPE '\\'
            OR actor_name ILIKE ${pattern} ESCAPE '\\'
            OR resource_type ILIKE ${pattern} ESCAPE '\\'
          )`);
            }
        }
        return client_1.Prisma.join(parts, ' AND ');
    }
    buildOrderClause(sortBy, sortDir) {
        const dir = sortDir === 'asc' ? client_1.Prisma.sql `ASC` : client_1.Prisma.sql `DESC`;
        switch (sortBy) {
            case 'action':
                return client_1.Prisma.sql `ORDER BY action ${dir}, created_at DESC, id DESC`;
            case 'actor_email':
                return client_1.Prisma.sql `ORDER BY actor_email ${dir}, created_at DESC, id DESC`;
            case 'actor_role':
                return client_1.Prisma.sql `ORDER BY actor_role ${dir}, created_at DESC, id DESC`;
            case 'resource_type':
                return client_1.Prisma.sql `ORDER BY resource_type ${dir}, created_at DESC, id DESC`;
            case 'created_at':
            default:
                return client_1.Prisma.sql `ORDER BY created_at ${dir}, id ${dir}`;
        }
    }
    buildCursorClause(cursor, sortDir) {
        const parsed = this.parseCursor(cursor);
        const op = sortDir === 'asc' ? client_1.Prisma.sql `>` : client_1.Prisma.sql `<`;
        return client_1.Prisma.sql `AND (created_at, id) ${op} (${parsed.createdAt}, ${parsed.id}::uuid)`;
    }
    parseCursor(cursor) {
        const trimmed = cursor.trim();
        const sep = trimmed.lastIndexOf('|');
        if (sep <= 0)
            throw new common_1.BadRequestException('Invalid cursor.');
        const left = trimmed.slice(0, sep);
        const id = trimmed.slice(sep + 1);
        if (!UUID_RE.test(id))
            throw new common_1.BadRequestException('Invalid cursor.');
        const createdAt = new Date(left);
        if (Number.isNaN(createdAt.getTime()))
            throw new common_1.BadRequestException('Invalid cursor.');
        return { id, createdAt };
    }
    encodeCursor(createdAtIso, id) {
        return `${createdAtIso}|${id}`;
    }
    partitionQuarterEnd(partitionName) {
        const m = PARTITION_NAME_RE.exec(partitionName);
        if (!m)
            return null;
        const year = parseInt(m[1], 10);
        const quarter = parseInt(m[2], 10);
        return new Date(Date.UTC(year, quarter * 3, 1));
    }
    assertRowVisible(user, row) {
        if (row.company_id) {
            this.companyAccess.assertCompanyAccess(user, row.company_id);
            if (user.companyId && row.company_id !== user.companyId) {
                throw new common_1.NotFoundException('Audit log entry not found.');
            }
            return;
        }
        if (user.tenantScope === 'all')
            return;
        if (row.actor_id === user.id)
            return;
        throw new common_1.NotFoundException('Audit log entry not found.');
    }
    escapeIlike(value) {
        return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    }
    toSummary(row) {
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
    toDetail(row) {
        return {
            ...this.toSummary(row),
            previousState: (0, audit_log_redaction_util_1.redactAuditState)(row.previous_state),
            newState: (0, audit_log_redaction_util_1.redactAuditState)(row.new_state),
            userAgent: row.user_agent,
        };
    }
    toCsv(rows) {
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
            lines.push([
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
                .join(','));
        }
        return lines.join('\n');
    }
    csvEscape(value) {
        if (/[",\n\r]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
};
exports.AuditLogsService = AuditLogsService;
exports.AuditLogsService = AuditLogsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        audit_log_policy_config_1.AuditLogPolicyConfig,
        audit_log_service_1.AuditLogService])
], AuditLogsService);
//# sourceMappingURL=audit-logs.service.js.map