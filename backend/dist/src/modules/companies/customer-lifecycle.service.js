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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CustomerLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerLifecycleService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const refresh_session_service_1 = require("../auth/refresh-session.service");
const DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;
const INBOUND_OPEN_STATUSES = [
    'draft',
    'pending_approval',
    'confirmed',
    'in_progress',
    'partially_received',
];
const OUTBOUND_OPEN_STATUSES = [
    'draft',
    'pending_approval',
    'pending_stock',
    'confirmed',
    'picking',
    'packing',
    'ready_to_ship',
];
const RETURN_OPEN_STATUSES = ['draft', 'confirmed', 'receiving', 'inspecting'];
const UNRESOLVED_INVOICE_STATUSES = ['open', 'overdue'];
let CustomerLifecycleService = CustomerLifecycleService_1 = class CustomerLifecycleService {
    prisma;
    companyAccess;
    audit;
    refreshSessions;
    config;
    logger = new common_1.Logger(CustomerLifecycleService_1.name);
    constructor(prisma, companyAccess, audit, refreshSessions, config) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.audit = audit;
        this.refreshSessions = refreshSessions;
        this.config = config;
    }
    retentionDays() {
        const raw = this.config.get('CUSTOMER_PURGE_RETENTION_DAYS');
        const n = typeof raw === 'number' ? raw : raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RETENTION_DAYS;
    }
    async getCompanyOrThrow(id) {
        const company = await this.prisma.company.findUnique({ where: { id } });
        if (!company)
            throw new common_1.NotFoundException('Company not found.');
        return company;
    }
    async gatherCounts(id) {
        const [products, inboundOrders, openInbound, outboundOrders, openOutbound, returns, openReturns, stockAgg, stockRows, ledgerEntries, invoices, unresolvedInvoices, openBillingCycles, users, activeUsers,] = await Promise.all([
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
            this.prisma.user.count({ where: { companyId: id, status: client_1.UserStatus.active } }),
        ]);
        let auditReferences = 0;
        try {
            const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT COUNT(*)::bigint AS c FROM audit_logs WHERE company_id = ${id}::uuid`);
            auditReferences = Number(rows[0]?.c ?? 0);
        }
        catch (e) {
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
    async getContext(user, id) {
        this.companyAccess.assertCompanyAccess(user, id);
        const company = await this.getCompanyOrThrow(id);
        const counts = await this.gatherCounts(id);
        const retentionDays = this.retentionDays();
        const hasStock = counts.stockOnHand > 0;
        const hasOpenOrders = counts.openInbound + counts.openOutbound + counts.openReturns > 0;
        const hasHistory = counts.products +
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
        const archiveBlockers = [];
        if (hasStock) {
            archiveBlockers.push('This customer still owns inventory inside the warehouse.');
        }
        if (hasOpenOrders) {
            archiveBlockers.push('This customer has open orders. Cancel or complete every order before archiving.');
        }
        const deleteBlockers = [];
        if (!isEmpty) {
            deleteBlockers.push('This customer has historical data (products, orders, inventory, billing or audit records). Permanent deletion would break referential integrity — archive instead.');
        }
        const retentionElapsedDays = company.archivedAt
            ? Math.floor((Date.now() - company.archivedAt.getTime()) / DAY_MS)
            : null;
        const purgeBlockers = this.computePurgeBlockers(company, counts, retentionDays, retentionElapsedDays);
        const terminal = company.status === client_1.CompanyStatus.purged;
        const canSuspend = !terminal &&
            company.status !== client_1.CompanyStatus.archived &&
            company.status !== client_1.CompanyStatus.suspended;
        const canArchive = !terminal &&
            company.status !== client_1.CompanyStatus.archived &&
            archiveBlockers.length === 0;
        const canRestore = !terminal &&
            company.status !== client_1.CompanyStatus.active;
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
    computePurgeBlockers(company, counts, retentionDays, retentionElapsedDays) {
        const blockers = [];
        if (company.status !== client_1.CompanyStatus.archived) {
            blockers.push('Customer must be archived before it can be purged.');
        }
        if (company.status === client_1.CompanyStatus.archived) {
            if (retentionElapsedDays === null) {
                blockers.push('Archive date is missing.');
            }
            else if (retentionElapsedDays < retentionDays) {
                blockers.push(`Customer must remain archived for at least ${retentionDays} days (currently ${retentionElapsedDays}).`);
            }
        }
        if (counts.stockOnHand > 0)
            blockers.push('Customer still owns inventory (stock > 0).');
        if (counts.openInbound > 0)
            blockers.push('Customer has pending inbound orders.');
        if (counts.openOutbound > 0)
            blockers.push('Customer has pending outbound orders.');
        if (counts.openReturns > 0)
            blockers.push('Customer has open return orders.');
        if (counts.activeUsers > 0)
            blockers.push('Customer still has active users.');
        if (counts.openBillingCycles > 0)
            blockers.push('Customer has open billing cycles.');
        if (counts.unresolvedInvoices > 0) {
            blockers.push('Customer has unresolved financial records (open or overdue invoices).');
        }
        return blockers;
    }
    async revokeCompanyUserSessions(companyId) {
        const users = await this.prisma.user.findMany({
            where: { companyId },
            select: { id: true },
        });
        for (const u of users) {
            try {
                await this.refreshSessions.invalidateUserSessions(u.id);
            }
            catch (e) {
                this.logger.warn(`Failed to revoke sessions for user ${u.id}: ${String(e)}`);
            }
        }
    }
    async suspend(user, id, reason) {
        this.companyAccess.assertCompanyAccess(user, id);
        const company = await this.getCompanyOrThrow(id);
        if (company.status === client_1.CompanyStatus.purged) {
            throw new common_1.ConflictException('Purged customers cannot be modified.');
        }
        const previousStatus = company.status;
        const updated = await this.prisma.company.update({
            where: { id },
            data: {
                status: client_1.CompanyStatus.suspended,
                suspendedAt: new Date(),
                suspendedBy: user.id,
                suspensionReason: reason?.trim() || null,
            },
        });
        await this.revokeCompanyUserSessions(id);
        await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
            action: 'customer.suspended',
            resourceType: 'company',
            resourceId: id,
            companyId: id,
            previousState: { status: previousStatus },
            newState: { status: updated.status, reason: reason?.trim() || null },
        }));
        return updated;
    }
    async archive(user, id, reason) {
        this.companyAccess.assertCompanyAccess(user, id);
        const company = await this.getCompanyOrThrow(id);
        if (company.status === client_1.CompanyStatus.purged) {
            throw new common_1.ConflictException('Purged customers cannot be modified.');
        }
        const counts = await this.gatherCounts(id);
        if (counts.stockOnHand > 0) {
            throw new common_1.BadRequestException('This customer still owns inventory inside the warehouse.');
        }
        if (counts.openInbound + counts.openOutbound + counts.openReturns > 0) {
            throw new common_1.BadRequestException('This customer has open orders. Cancel or complete every order before archiving.');
        }
        const previousStatus = company.status;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.user.updateMany({
                where: { companyId: id, status: client_1.UserStatus.active },
                data: { status: client_1.UserStatus.inactive },
            });
            return tx.company.update({
                where: { id },
                data: {
                    status: client_1.CompanyStatus.archived,
                    archivedAt: new Date(),
                    archivedBy: user.id,
                    archiveReason: reason?.trim() || null,
                },
            });
        });
        await this.revokeCompanyUserSessions(id);
        await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
            action: 'customer.archived',
            resourceType: 'company',
            resourceId: id,
            companyId: id,
            previousState: { status: previousStatus },
            newState: { status: updated.status, reason: reason?.trim() || null },
        }));
        return updated;
    }
    async restore(user, id, reason) {
        this.companyAccess.assertCompanyAccess(user, id);
        const company = await this.getCompanyOrThrow(id);
        if (company.status === client_1.CompanyStatus.purged) {
            throw new common_1.ConflictException('Purged customers cannot be restored.');
        }
        if (company.status === client_1.CompanyStatus.active) {
            throw new common_1.ConflictException('Customer is already active.');
        }
        const previousStatus = company.status;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.user.updateMany({
                where: { companyId: id, status: client_1.UserStatus.inactive },
                data: { status: client_1.UserStatus.active },
            });
            return tx.company.update({
                where: { id },
                data: {
                    status: client_1.CompanyStatus.active,
                    suspendedAt: null,
                    suspendedBy: null,
                    suspensionReason: null,
                    archivedAt: null,
                    archivedBy: null,
                    archiveReason: null,
                },
            });
        });
        await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
            action: 'customer.restored',
            resourceType: 'company',
            resourceId: id,
            companyId: id,
            previousState: { status: previousStatus },
            newState: { status: updated.status, reason: reason?.trim() || null },
        }));
        return updated;
    }
    async hardDelete(user, id) {
        this.companyAccess.assertCompanyAccess(user, id);
        const company = await this.getCompanyOrThrow(id);
        const counts = await this.gatherCounts(id);
        const isEmpty = counts.products +
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
            throw new common_1.ConflictException('This customer has historical data and cannot be permanently deleted. Archive it instead.');
        }
        try {
            await this.prisma.company.delete({ where: { id } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new common_1.ConflictException('This customer has related data and was not deleted. Archive it instead.');
            }
            throw e;
        }
        await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
            action: 'customer.deleted',
            resourceType: 'company',
            resourceId: id,
            companyId: null,
            previousState: { status: company.status, name: company.name },
            newState: { deleted: true },
        }));
        return { id, deleted: true };
    }
    async purge(user, id) {
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only a super administrator can purge customers.');
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
            throw new common_1.ConflictException(`This customer is not eligible for permanent purge: ${blockers.join(' ')}`);
        }
        const exportPath = await this.generateArchiveExport(company, counts);
        const isEmpty = counts.products +
            counts.inboundOrders +
            counts.outboundOrders +
            counts.returns +
            counts.stockRows +
            counts.ledgerEntries +
            counts.invoices +
            counts.users +
            counts.auditReferences ===
            0;
        let mode;
        if (isEmpty) {
            await this.prisma.company.delete({ where: { id } });
            mode = 'deleted';
        }
        else {
            const shortId = id.slice(0, 8);
            await this.prisma.$transaction(async (tx) => {
                await tx.user.updateMany({
                    where: { companyId: id },
                    data: { status: client_1.UserStatus.inactive },
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
                        status: client_1.CompanyStatus.purged,
                        purgedAt: new Date(),
                    },
                });
            });
            mode = 'anonymized';
        }
        await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
            action: 'customer.purged',
            resourceType: 'company',
            resourceId: id,
            companyId: mode === 'deleted' ? null : id,
            previousState: { status: company.status, name: company.name },
            newState: { mode, exportPath, counts },
        }));
        return { id, purged: true, mode, exportPath };
    }
    async generateArchiveExport(company, counts) {
        try {
            const dir = node_path_1.default.join(process.cwd(), 'storage', 'customer-archives');
            await node_fs_1.promises.mkdir(dir, { recursive: true });
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
            const file = node_path_1.default.join(dir, `${company.id}-${Date.now()}.json`);
            await node_fs_1.promises.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
            return file;
        }
        catch (e) {
            this.logger.warn(`Archive export failed for company ${company.id}: ${String(e)}`);
            return null;
        }
    }
};
exports.CustomerLifecycleService = CustomerLifecycleService;
exports.CustomerLifecycleService = CustomerLifecycleService = CustomerLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        audit_log_service_1.AuditLogService,
        refresh_session_service_1.RefreshSessionService,
        config_1.ConfigService])
], CustomerLifecycleService);
//# sourceMappingURL=customer-lifecycle.service.js.map