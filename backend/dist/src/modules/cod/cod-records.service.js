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
exports.CodRecordsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const realtime_service_1 = require("../realtime/realtime.service");
const INCLUDE = {
    company: { select: { id: true, name: true } },
    omsOrder: {
        select: {
            id: true,
            orderNumber: true,
            status: true,
            recipientName: true,
            paymentMethod: true,
        },
    },
    adjustments: { orderBy: { createdAt: 'asc' } },
};
function serialize(record) {
    const adjustmentSum = record.adjustments.reduce((s, a) => s.add(a.amount), new client_1.Prisma.Decimal(0));
    const currentAmount = record.originalAmount.add(adjustmentSum);
    return {
        id: record.id,
        companyId: record.companyId,
        company: record.company ?? null,
        omsOrderId: record.omsOrderId,
        omsOrder: record.omsOrder ?? null,
        originalAmount: record.originalAmount.toString(),
        currentAmount: currentAmount.toString(),
        currency: record.currency,
        status: record.status,
        notes: record.notes,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        availableAt: record.availableAt,
        paidOutAt: record.paidOutAt,
        adjustments: record.adjustments.map((a) => ({
            id: a.id,
            amount: a.amount.toString(),
            reason: a.reason,
            omsReturnId: a.omsReturnId,
            createdAt: a.createdAt,
            createdBy: a.createdBy,
        })),
    };
}
let CodRecordsService = class CodRecordsService {
    prisma;
    companyAccess;
    realtime;
    constructor(prisma, companyAccess, realtime) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.realtime = realtime;
    }
    async recordEvent(tx, params) {
        await tx.omsOrderEvent.create({
            data: {
                omsOrderId: params.omsOrderId,
                companyId: params.companyId,
                eventType: params.eventType,
                createdBy: params.createdBy,
                payload: params.payload,
            },
        });
    }
    async list(user, query) {
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId)
            where.companyId = companyId;
        if (query.status)
            where.status = query.status;
        if (query.omsOrderId)
            where.omsOrderId = query.omsOrderId;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.codRecord.findMany({
                    where,
                    include: INCLUDE,
                    orderBy: { createdAt: 'desc' },
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.codRecord.count({ where }),
            ]);
            return {
                items: items.map(serialize),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async findById(id, user) {
        const record = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.codRecord.findUnique({ where: { id }, include: INCLUDE }));
        if (!record)
            throw new common_1.NotFoundException('COD record not found.');
        this.companyAccess.validateResourceOwnership(user, record);
        return serialize(record);
    }
    async findByOmsOrder(omsOrderId, user) {
        const record = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.codRecord.findUnique({
            where: { omsOrderId },
            include: INCLUDE,
        }));
        if (!record)
            return null;
        this.companyAccess.validateResourceOwnership(user, record);
        return serialize(record);
    }
    async generateForDeliveredOrder(user, omsOrderId) {
        const order = await this.prisma.omsOrder.findUnique({
            where: { id: omsOrderId },
        });
        if (!order)
            throw new common_1.NotFoundException('OMS order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        if (order.status !== client_1.OmsOrderStatus.delivered) {
            throw new domain_exceptions_1.InvalidStateException('COD is only generated for Delivered orders.');
        }
        if (order.paymentMethod !== 'COD') {
            await this.prisma.omsOrder.update({
                where: { id: omsOrderId },
                data: { codGenerationStatus: client_1.CodGenerationStatus.none },
            });
            return null;
        }
        const existing = await this.prisma.codRecord.findUnique({
            where: { omsOrderId },
            include: INCLUDE,
        });
        if (existing) {
            await this.prisma.omsOrder.update({
                where: { id: omsOrderId },
                data: { codGenerationStatus: client_1.CodGenerationStatus.ok },
            });
            return serialize(existing);
        }
        const amount = order.codAmount ?? order.subtotal ?? new client_1.Prisma.Decimal(0);
        if (amount.isZero()) {
            throw new common_1.BadRequestException('COD amount is zero; cannot generate COD record.');
        }
        try {
            const created = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
                const row = await tx.codRecord.create({
                    data: {
                        companyId: order.companyId,
                        omsOrderId: order.id,
                        originalAmount: amount,
                        currency: order.currency ?? 'SYP',
                        status: client_1.CodRecordStatus.pending,
                        createdBy: user.id,
                    },
                    include: INCLUDE,
                });
                await tx.omsOrder.update({
                    where: { id: omsOrderId },
                    data: {
                        codGenerationStatus: client_1.CodGenerationStatus.ok,
                        codStatus: 'pending',
                    },
                });
                await this.recordEvent(tx, {
                    omsOrderId,
                    companyId: order.companyId,
                    eventType: 'cod.generated',
                    createdBy: user.id,
                    payload: { codRecordId: row.id, originalAmount: amount.toString() },
                });
                return row;
            });
            return serialize(created);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                const again = await this.prisma.codRecord.findUnique({
                    where: { omsOrderId },
                    include: INCLUDE,
                });
                if (again) {
                    await this.prisma.omsOrder.update({
                        where: { id: omsOrderId },
                        data: { codGenerationStatus: client_1.CodGenerationStatus.ok },
                    });
                    return serialize(again);
                }
            }
            await this.prisma.omsOrder.update({
                where: { id: omsOrderId },
                data: { codGenerationStatus: client_1.CodGenerationStatus.failed },
            });
            throw err;
        }
    }
    async retryGeneration(omsOrderId, user) {
        return this.generateForDeliveredOrder(user, omsOrderId);
    }
    async setStatus(id, user, status) {
        const existing = await this.prisma.codRecord.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('COD record not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status === status) {
            const full = await this.prisma.codRecord.findUnique({
                where: { id },
                include: INCLUDE,
            });
            return serialize(full);
        }
        const transitions = {
            pending: ['available'],
            available: ['paid_out'],
            paid_out: [],
        };
        if (!transitions[existing.status].includes(status)) {
            throw new domain_exceptions_1.InvalidStateException(`Cannot change COD status from ${existing.status} to ${status}.`);
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.codRecord.update({
                where: { id },
                data: {
                    status,
                    availableAt: status === 'available' ? new Date() : undefined,
                    paidOutAt: status === 'paid_out' ? new Date() : undefined,
                },
                include: INCLUDE,
            });
            await this.recordEvent(tx, {
                omsOrderId: row.omsOrderId,
                companyId: row.companyId,
                eventType: 'cod.status_changed',
                createdBy: user.id,
                payload: { from: existing.status, to: status, codRecordId: id },
            });
            if (status === 'available') {
                await tx.omsOrder.update({
                    where: { id: row.omsOrderId },
                    data: { codStatus: 'collected', codCollectedAt: new Date() },
                });
            }
            if (status === 'paid_out') {
                await tx.omsOrder.update({
                    where: { id: row.omsOrderId },
                    data: { codStatus: 'remitted', codRemittedAt: new Date() },
                });
            }
            return row;
        });
        this.realtime.emitCodUpdated(updated.companyId, {
            orderId: updated.omsOrderId,
            codRecordId: updated.id,
            status,
        });
        return serialize(updated);
    }
    async addManualAdjustment(id, user, dto) {
        const existing = await this.prisma.codRecord.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('COD record not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status === client_1.CodRecordStatus.paid_out) {
            throw new domain_exceptions_1.InvalidStateException('Cannot adjust a paid-out COD record.');
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.codAdjustment.create({
                data: {
                    codRecordId: id,
                    amount: new client_1.Prisma.Decimal(dto.amount),
                    reason: dto.reason?.trim() || 'Manual adjustment',
                    createdBy: user.id,
                },
            });
            await this.recordEvent(tx, {
                omsOrderId: existing.omsOrderId,
                companyId: existing.companyId,
                eventType: 'cod.adjustment_created',
                createdBy: user.id,
                payload: { amount: dto.amount, reason: dto.reason, manual: true },
            });
            return tx.codRecord.findUnique({ where: { id }, include: INCLUDE });
        });
        return serialize(updated);
    }
    async createReturnAdjustment(params) {
        const existingAdj = await this.prisma.codAdjustment.findUnique({
            where: { omsReturnId: params.omsReturnId },
        });
        if (existingAdj) {
            const record = await this.prisma.codRecord.findUnique({
                where: { id: existingAdj.codRecordId },
                include: INCLUDE,
            });
            return record ? serialize(record) : null;
        }
        const cod = await this.prisma.codRecord.findUnique({
            where: { omsOrderId: params.omsOrderId },
        });
        if (!cod) {
            throw new common_1.BadRequestException('No COD record for this order; cannot create return adjustment.');
        }
        const signed = params.amount.isPositive()
            ? params.amount.negated()
            : params.amount;
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, params.user, async (tx) => {
            await tx.codAdjustment.create({
                data: {
                    codRecordId: cod.id,
                    omsReturnId: params.omsReturnId,
                    amount: signed,
                    reason: params.reason?.trim() || 'OMS return completed',
                    createdBy: params.user.id,
                },
            });
            await this.recordEvent(tx, {
                omsOrderId: params.omsOrderId,
                companyId: params.companyId,
                eventType: 'cod.adjustment_created',
                createdBy: params.user.id,
                payload: {
                    omsReturnId: params.omsReturnId,
                    amount: signed.toString(),
                },
            });
            return tx.codRecord.findUnique({ where: { id: cod.id }, include: INCLUDE });
        });
        return serialize(updated);
    }
};
exports.CodRecordsService = CodRecordsService;
exports.CodRecordsService = CodRecordsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        realtime_service_1.RealtimeService])
], CodRecordsService);
//# sourceMappingURL=cod-records.service.js.map