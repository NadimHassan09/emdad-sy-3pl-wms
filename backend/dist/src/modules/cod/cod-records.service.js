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
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const branding_1 = require("../../pdf/branding");
const pdf_service_1 = require("../../pdf/pdf.service");
const realtime_service_1 = require("../realtime/realtime.service");
const cod_list_filter_util_1 = require("./cod-list-filter.util");
const cod_export_pdf_util_1 = require("./cod-export-pdf.util");
const cod_export_util_1 = require("./cod-export.util");
const EXPORT_PAGE_SIZE = 500;
const INCLUDE = {
    company: { select: { id: true, name: true } },
    omsOrder: {
        select: {
            id: true,
            orderNumber: true,
            status: true,
            recipientName: true,
            paymentMethod: true,
            trackingNumber: true,
            outboundOrderId: true,
            outboundOrder: {
                select: {
                    id: true,
                    orderNumber: true,
                    trackingNumber: true,
                },
            },
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
    pdf;
    config;
    constructor(prisma, companyAccess, realtime, pdf, config) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.realtime = realtime;
        this.pdf = pdf;
        this.config = config;
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
    resolveListWhere(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        return (0, cod_list_filter_util_1.buildCodRecordWhere)({
            companyId,
            status: query.status,
            omsOrderId: query.omsOrderId,
            search: query.search,
            createdFrom: query.createdFrom,
            createdTo: query.createdTo,
            amountMin: query.amountMin,
            amountMax: query.amountMax,
        });
    }
    async list(user, query) {
        const where = this.resolveListWhere(user, query);
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
    async loadExportDataset(user, query) {
        const where = this.resolveListWhere(user, query);
        const records = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const rows = [];
            let offset = 0;
            for (;;) {
                const page = await tx.codRecord.findMany({
                    where,
                    include: INCLUDE,
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: EXPORT_PAGE_SIZE,
                    skip: offset,
                });
                for (const record of page) {
                    const serialized = serialize(record);
                    rows.push({
                        id: serialized.id,
                        companyName: serialized.company?.name ?? null,
                        omsOrderId: serialized.omsOrderId,
                        orderNumber: serialized.omsOrder?.orderNumber ?? null,
                        outboundOrderNumber: serialized.omsOrder?.outboundOrder?.orderNumber ?? null,
                        recipientName: serialized.omsOrder?.recipientName ?? null,
                        trackingNumber: serialized.omsOrder?.trackingNumber?.trim() ||
                            serialized.omsOrder?.outboundOrder?.trackingNumber?.trim() ||
                            null,
                        currentAmount: serialized.currentAmount,
                        currency: serialized.currency,
                        status: serialized.status,
                        availableAt: serialized.availableAt,
                        paidOutAt: serialized.paidOutAt,
                    });
                }
                if (page.length < EXPORT_PAGE_SIZE)
                    break;
                offset += page.length;
            }
            return rows;
        });
        let clientLabel = 'All Clients';
        const scopedCompanyId = where.companyId;
        if (typeof scopedCompanyId === 'string' && scopedCompanyId) {
            const company = await this.prisma.company.findUnique({
                where: { id: scopedCompanyId },
                select: { name: true },
            });
            clientLabel = company?.name?.trim() || scopedCompanyId;
        }
        return { records, clientLabel };
    }
    async exportXlsx(user, query) {
        const { records, clientLabel } = await this.loadExportDataset(user, query);
        const buffer = await (0, cod_export_util_1.buildCodReportWorkbook)({
            records,
            exportedAt: new Date(),
            clientLabel,
        });
        return { buffer, filename: (0, cod_export_util_1.codExportFilename)(clientLabel, 'xlsx') };
    }
    async exportPdf(user, query) {
        const { records, clientLabel } = await this.loadExportDataset(user, query);
        const branding = (0, branding_1.resolveBranding)(this.config);
        const html = (0, cod_export_pdf_util_1.buildCodReportHtml)({
            records,
            clientLabel,
            brand: {
                companyName: branding.companyName,
                companyNameAr: branding.companyNameAr,
                tagline: branding.tagline,
                logoDataUri: this.pdf.logo,
                fontFaceCss: this.pdf.fontFaceCss,
            },
        });
        const buffer = await this.pdf.renderHtml(html, {
            format: 'A4',
            landscape: true,
            preferCSSPageSize: false,
            margin: { top: '10mm', bottom: '16mm', left: '10mm', right: '10mm' },
            footerTemplate: (0, cod_export_pdf_util_1.buildCodPdfFooterTemplate)(branding.companyName),
        });
        return { buffer, filename: (0, cod_export_util_1.codExportFilename)(clientLabel, 'pdf') };
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
        const amount = order.codAmount ?? new client_1.Prisma.Decimal(0);
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
                        currency: order.currency ?? 'USD',
                        status: client_1.CodRecordStatus.pending,
                        createdBy: user.id,
                    },
                    include: INCLUDE,
                });
                await tx.clientFinancialAccount.upsert({
                    where: { companyId: order.companyId },
                    create: {
                        companyId: order.companyId,
                        pendingBalance: amount,
                        currency: order.currency ?? 'USD',
                    },
                    update: {
                        pendingBalance: { increment: amount },
                    },
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
    async voidForDeliveryRevert(user, omsOrderId, reason) {
        const order = await this.prisma.omsOrder.findUnique({ where: { id: omsOrderId } });
        if (!order)
            throw new common_1.NotFoundException('OMS order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        const existing = await this.prisma.codRecord.findUnique({
            where: { omsOrderId },
            include: { adjustments: true },
        });
        if (!existing) {
            await this.prisma.omsOrder.update({
                where: { id: omsOrderId },
                data: {
                    codGenerationStatus: client_1.CodGenerationStatus.none,
                    codStatus: order.paymentMethod === 'COD' ? 'pending' : null,
                    codCollectedAt: null,
                    codRemittedAt: null,
                },
            });
            return null;
        }
        if (existing.status === client_1.CodRecordStatus.paid_out) {
            throw new domain_exceptions_1.InvalidStateException('Cannot revert delivery while COD is paid out. Reverse payout first.');
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.codRecord.delete({ where: { id: existing.id } });
            if (existing.status === client_1.CodRecordStatus.pending) {
                await tx.clientFinancialAccount.updateMany({
                    where: { companyId: existing.companyId },
                    data: {
                        pendingBalance: { decrement: existing.originalAmount },
                    },
                });
            }
            await tx.omsOrder.update({
                where: { id: omsOrderId },
                data: {
                    codGenerationStatus: client_1.CodGenerationStatus.none,
                    codStatus: order.paymentMethod === 'COD' ? 'pending' : null,
                    codCollectedAt: null,
                    codRemittedAt: null,
                },
            });
            await this.recordEvent(tx, {
                omsOrderId,
                companyId: order.companyId,
                eventType: 'cod.voided_on_delivery_revert',
                createdBy: user.id,
                payload: {
                    previousCodRecordId: existing.id,
                    previousAmount: existing.originalAmount.toString(),
                    reason,
                },
            });
        });
        this.realtime.emitCodUpdated(order.companyId, {
            orderId: omsOrderId,
            codRecordId: existing.id,
            status: 'voided',
        });
        return { voided: true, previousCodRecordId: existing.id };
    }
    async setStatusByScan(user, rawCode, status) {
        const trimmed = (rawCode || '').trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Please scan or enter a valid code.');
        }
        let cleanCode = trimmed;
        try {
            if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
                const url = new URL(cleanCode);
                const segments = url.pathname.split('/').filter(Boolean);
                if (segments.length > 0) {
                    cleanCode = decodeURIComponent(segments[segments.length - 1]);
                }
            }
        }
        catch {
        }
        const strippedEmd = cleanCode.replace(/^emd-/i, '');
        const candidates = Array.from(new Set([cleanCode, trimmed, strippedEmd].filter(Boolean)));
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let matchedOrder = null;
        for (const candidate of candidates) {
            const isUuid = uuidRe.test(candidate);
            const order = await this.prisma.omsOrder.findFirst({
                where: {
                    OR: [
                        ...(isUuid ? [{ id: candidate }] : []),
                        { orderNumber: { equals: candidate, mode: 'insensitive' } },
                        { clientReference: { equals: candidate, mode: 'insensitive' } },
                        { trackingNumber: { equals: candidate, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    companyId: true,
                    orderNumber: true,
                    company: { select: { name: true } },
                },
            });
            if (order) {
                matchedOrder = order;
                break;
            }
        }
        if (!matchedOrder) {
            for (const candidate of candidates) {
                const outbound = await this.prisma.outboundOrder.findFirst({
                    where: {
                        OR: [
                            { trackingNumber: { equals: candidate, mode: 'insensitive' } },
                            { orderNumber: { equals: candidate, mode: 'insensitive' } },
                        ],
                    },
                    select: {
                        omsOrder: {
                            select: {
                                id: true,
                                companyId: true,
                                orderNumber: true,
                                company: { select: { name: true } },
                            },
                        },
                    },
                });
                if (outbound?.omsOrder) {
                    matchedOrder = outbound.omsOrder;
                    break;
                }
                const carrierShipment = await this.prisma.carrierShipment.findFirst({
                    where: {
                        OR: [
                            { trackingNumber: { equals: candidate, mode: 'insensitive' } },
                            { externalAwb: { equals: candidate, mode: 'insensitive' } },
                        ],
                    },
                    select: {
                        outboundOrder: {
                            select: {
                                omsOrder: {
                                    select: {
                                        id: true,
                                        companyId: true,
                                        orderNumber: true,
                                        company: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                });
                if (carrierShipment?.outboundOrder?.omsOrder) {
                    matchedOrder = carrierShipment.outboundOrder.omsOrder;
                    break;
                }
            }
        }
        if (!matchedOrder) {
            throw new common_1.NotFoundException(`No order found for code (${cleanCode}). Scan the correct waybill QR.`);
        }
        this.companyAccess.validateResourceOwnership(user, matchedOrder);
        const record = await this.prisma.codRecord.findUnique({
            where: { omsOrderId: matchedOrder.id },
            select: { id: true, status: true, companyId: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Order ${matchedOrder.orderNumber} has no COD record.`);
        }
        this.companyAccess.validateResourceOwnership(user, record);
        const orderNumber = matchedOrder.orderNumber;
        const clientName = matchedOrder.company?.name ?? '—';
        if (record.status === status) {
            return {
                ok: true,
                action: 'unchanged',
                codRecordId: record.id,
                orderNumber,
                clientName,
                previousStatus: record.status,
                status,
                message: `${orderNumber} is already ${status}; no change.`,
            };
        }
        await this.setStatus(record.id, user, status);
        return {
            ok: true,
            action: 'updated',
            codRecordId: record.id,
            orderNumber,
            clientName,
            previousStatus: record.status,
            status,
            message: `${orderNumber} COD status set to ${status}.`,
        };
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
        const now = new Date();
        const availableAt = status === 'pending' || status === 'returned'
            ? null
            : status === 'available'
                ? existing.availableAt ?? now
                : existing.availableAt ?? now;
        const paidOutAt = status === 'paid_out' ? existing.paidOutAt ?? now : null;
        const legacyCodStatus = status === 'pending' || status === 'returned'
            ? 'pending'
            : status === 'available'
                ? 'collected'
                : 'remitted';
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.codRecord.update({
                where: { id },
                data: {
                    status,
                    availableAt,
                    paidOutAt,
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
            await tx.omsOrder.update({
                where: { id: row.omsOrderId },
                data: {
                    codStatus: legacyCodStatus,
                    ...(status === 'available'
                        ? { codCollectedAt: existing.availableAt ?? now }
                        : {}),
                    ...(status === 'paid_out'
                        ? { codRemittedAt: existing.paidOutAt ?? now }
                        : {}),
                    ...(status === 'pending' || status === 'returned'
                        ? { codCollectedAt: null, codRemittedAt: null }
                        : {}),
                },
            });
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
        if (existing.status === client_1.CodRecordStatus.returned) {
            throw new domain_exceptions_1.InvalidStateException('Cannot adjust a returned COD record.');
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
            await this.syncReturnedStatusIfNeeded(params.omsOrderId, params.user);
            const record = await this.prisma.codRecord.findUnique({
                where: { id: existingAdj.codRecordId },
                include: INCLUDE,
            });
            return record ? serialize(record) : null;
        }
        const cod = await this.prisma.codRecord.findUnique({
            where: { omsOrderId: params.omsOrderId },
            include: { adjustments: true },
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
        if (updated) {
            this.realtime.emitCodUpdated(updated.companyId, {
                orderId: updated.omsOrderId,
                codRecordId: updated.id,
                status: updated.status,
            });
        }
        await this.syncReturnedStatusIfNeeded(params.omsOrderId, params.user);
        return serialize(updated);
    }
    async markReturnedForOrder(omsOrderId, user) {
        return this.syncReturnedStatusIfNeeded(omsOrderId, user, true);
    }
    async syncReturnedStatusIfNeeded(omsOrderId, user, force = false) {
        const cod = await this.prisma.codRecord.findUnique({
            where: { omsOrderId },
            include: { adjustments: true, omsOrder: { select: { status: true } } },
        });
        if (!cod || cod.status === client_1.CodRecordStatus.returned)
            return null;
        const shouldReturn = force || cod.omsOrder?.status === client_1.OmsOrderStatus.returned;
        if (!shouldReturn)
            return null;
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.codRecord.update({
                where: { id: cod.id },
                data: {
                    status: client_1.CodRecordStatus.returned,
                    availableAt: null,
                    paidOutAt: null,
                },
                include: INCLUDE,
            });
            await this.recordEvent(tx, {
                omsOrderId,
                companyId: cod.companyId,
                eventType: 'cod.status_changed',
                createdBy: user.id,
                payload: {
                    from: cod.status,
                    to: client_1.CodRecordStatus.returned,
                    codRecordId: cod.id,
                    reason: force ? 'oms_order_returned' : 'oms_status_returned',
                },
            });
            return row;
        });
        this.realtime.emitCodUpdated(updated.companyId, {
            orderId: updated.omsOrderId,
            codRecordId: updated.id,
            status: updated.status,
        });
        return serialize(updated);
    }
};
exports.CodRecordsService = CodRecordsService;
exports.CodRecordsService = CodRecordsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        realtime_service_1.RealtimeService,
        pdf_service_1.PdfService,
        config_1.ConfigService])
], CodRecordsService);
//# sourceMappingURL=cod-records.service.js.map