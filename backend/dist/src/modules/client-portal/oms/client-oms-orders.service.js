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
exports.ClientOmsOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const oms_order_mapper_1 = require("../../oms/oms-order.mapper");
const oms_orders_service_1 = require("../../oms/oms-orders.service");
const oms_order_status_filter_util_1 = require("../../oms/oms-order-status-filter.util");
const excel_export_util_1 = require("../../../common/utils/excel-export.util");
const client_oms_order_lock_1 = require("./client-oms-order-lock");
const portal_cod_status_util_1 = require("./portal-cod-status.util");
function stripClientCarrierCosts(order) {
    const linked = order.linkedOutboundOrder;
    const next = { ...order };
    delete next.lastCarrierEvent;
    delete next.clientShippingRateBreakdown;
    delete next.clientShippingRateGroupId;
    delete next.carrier;
    delete next.shippingCarrierName;
    delete next.shippingProviderCode;
    delete next.shippingServiceId;
    delete next.shippingHubId;
    if (linked && typeof linked === 'object') {
        const copy = { ...linked };
        delete copy.shippingCost;
        delete copy.shippingCostCurrency;
        delete copy.shippingQuotedPrice;
        delete copy.shippingQuotedCurrency;
        delete copy.shippingProviderCode;
        delete copy.shippingServiceId;
        delete copy.carrier;
        delete copy.shippingCarrierName;
        delete copy.shippingHubId;
        next.linkedOutboundOrder = copy;
    }
    return next;
}
function matchesPortalCodFilter(portalStatus, filter) {
    if (!filter?.trim())
        return true;
    const f = filter.trim();
    if (f === 'settled')
        return portalStatus === 'remitted' || portalStatus === 'settled';
    if (f === 'available')
        return portalStatus === 'collected';
    if (f === 'paid_out')
        return portalStatus === 'remitted';
    if (f === 'returned')
        return portalStatus === 'returned';
    return portalStatus === f;
}
let ClientOmsOrdersService = class ClientOmsOrdersService {
    prisma;
    omsOrders;
    constructor(prisma, omsOrders) {
        this.prisma = prisma;
        this.omsOrders = omsOrders;
    }
    async list(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const scoped = {
            ...query,
            companyId: client.companyId,
        };
        const result = await this.omsOrders.list(user, scoped);
        return {
            ...result,
            items: result.items.map((item) => stripClientCarrierCosts(item)),
        };
    }
    async statusNavCounts(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.statusNavCounts(user, {
            ...query,
            companyId: client.companyId,
            status: undefined,
            operationalStage: undefined,
        });
    }
    async listForExport(client, query, opts) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        if (opts.ids?.length) {
            const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
            return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
                const rows = await tx.omsOrder.findMany({
                    where: {
                        companyId: client.companyId,
                        id: { in: unique.slice(0, opts.maxRows) },
                    },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        company: { select: { id: true, name: true } },
                        outboundOrder: { select: { id: true, orderNumber: true, status: true } },
                        lines: {
                            orderBy: { lineNumber: 'asc' },
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        sku: true,
                                        name: true,
                                        barcode: true,
                                        status: true,
                                        trackingType: true,
                                        uom: true,
                                        weightKg: true,
                                    },
                                },
                            },
                        },
                    },
                });
                return {
                    items: rows.map((row) => stripClientCarrierCosts((0, oms_order_mapper_1.serializeOmsOrder)(row))),
                    total: rows.length,
                    truncated: unique.length > rows.length,
                };
            });
        }
        return this.omsOrders.listForExport(user, { ...query, companyId: client.companyId, limit: opts.maxRows, offset: 0 }, { maxRows: opts.maxRows });
    }
    async statusSummary(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const fromStr = query.dateFrom ?? query.createdFrom;
        const toStr = query.dateTo ?? query.createdTo;
        const fromDate = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
        const toDate = toStr ? new Date(`${toStr}T23:59:59.999Z`) : undefined;
        const statusDateConditions = (0, oms_order_status_filter_util_1.buildOmsOrderStatusDateFilter)(fromDate, toDate);
        const where = {
            companyId: client.companyId,
            ...(statusDateConditions.length > 0 ? { OR: statusDateConditions } : {}),
        };
        if (query.storeChannel?.trim()) {
            where.storeChannel = {
                contains: query.storeChannel.trim(),
                mode: 'insensitive',
            };
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [grouped, channelRows] = await Promise.all([
                tx.omsOrder.groupBy({
                    by: ['status'],
                    where,
                    _count: { _all: true },
                }),
                tx.omsOrder.findMany({
                    where: {
                        companyId: client.companyId,
                        ...(statusDateConditions.length > 0 ? { OR: statusDateConditions } : {}),
                        storeChannel: { not: null },
                    },
                    select: { storeChannel: true },
                    distinct: ['storeChannel'],
                    take: 200,
                }),
            ]);
            const byStatus = {};
            let total = 0;
            for (const row of grouped) {
                const n = row._count._all;
                byStatus[row.status] = n;
                total += n;
            }
            const storeChannels = channelRows
                .map((r) => r.storeChannel?.trim())
                .filter((c) => !!c)
                .sort((a, b) => a.localeCompare(b));
            return { total, byStatus, storeChannels };
        });
    }
    async create(client, dto) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const payload = {
            companyId: client.companyId,
            requiredShipDate: dto.requiredShipDate,
            recipientName: dto.recipientName,
            recipientPhone: dto.recipientPhone,
            city: dto.city,
            district: dto.district,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            notes: dto.notes,
            storeChannel: dto.storeChannel,
            paymentMethod: dto.paymentMethod,
            currency: dto.currency ?? 'USD',
            shippingPhoneCountry: dto.shippingPhoneCountry,
            shippingReceiverLat: dto.shippingReceiverLat,
            shippingReceiverLng: dto.shippingReceiverLng,
            babelNeighbourhoodId: dto.babelNeighbourhoodId,
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                requestedQuantity: l.requestedQuantity,
                unitPrice: l.unitPrice,
            })),
        };
        return this.omsOrders.create(user, payload);
    }
    async createFromApi(client, dto) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const payload = {
            companyId: client.companyId,
            requiredShipDate: dto.requiredShipDate,
            recipientName: dto.recipientName,
            recipientPhone: dto.recipientPhone,
            city: dto.city,
            district: dto.district,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            notes: dto.notes,
            storeChannel: dto.storeChannel,
            paymentMethod: dto.paymentMethod,
            currency: dto.currency ?? 'USD',
            shippingPhoneCountry: dto.shippingPhoneCountry,
            externalReference: dto.externalReference,
            clientReference: dto.clientReference,
            shippingReceiverLat: dto.shippingReceiverLat,
            shippingReceiverLng: dto.shippingReceiverLng,
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                requestedQuantity: l.requestedQuantity,
                unitPrice: l.unitPrice,
            })),
        };
        return this.omsOrders.create(user, payload);
    }
    async findByExternalReference(client, externalReference) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.findExistingByExternalReference(user, client.companyId, externalReference);
    }
    async findByOrderNumber(client, orderNumber) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.findExistingByOrderNumber(user, client.companyId, orderNumber);
    }
    async resolveSkus(companyId, skus) {
        const unique = Array.from(new Set(skus.map((s) => s.trim()).filter(Boolean)));
        const products = await this.omsOrders.findProductsBySkus(companyId, unique);
        const map = new Map();
        for (const p of products) {
            map.set(p.sku.trim().toUpperCase(), p.id);
        }
        const missing = unique.filter((sku) => !map.has(sku.toUpperCase()));
        if (missing.length) {
            throw new common_1.BadRequestException({
                code: 'VALIDATION_ERROR',
                message: `Unknown SKU(s): ${missing.join(', ')}`,
                fields: { sku: `Unknown SKU(s): ${missing.join(', ')}` },
            });
        }
        return map;
    }
    async updateEditable(client, id, dto) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const existing = await this.omsOrders.findById(id, user);
        if (!client_oms_order_lock_1.CLIENT_EDITABLE_OMS_STATUSES.has(String(existing.status))) {
            throw new common_1.ForbiddenException((0, client_oms_order_lock_1.clientLockMessage)(String(existing.status)));
        }
        return this.omsOrders.update(id, user, dto);
    }
    async removeUnconfirmed(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const existing = await this.omsOrders.findById(id, user);
        if (!client_oms_order_lock_1.CLIENT_DELETABLE_OMS_STATUSES.has(String(existing.status))) {
            throw new common_1.ForbiddenException('Only orders that are not confirmed yet can be deleted. Use Cancel for a confirmed order.');
        }
        return this.omsOrders.delete(id, user);
    }
    async confirm(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.confirm(id, user);
    }
    async confirmBulk(client, ids) {
        const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
        const confirmed = [];
        const failed = [];
        for (const id of uniqueIds) {
            try {
                const order = await this.confirm(client, id);
                confirmed.push({
                    id: order.id,
                    orderNumber: order.orderNumber,
                });
            }
            catch (err) {
                let orderNumber = null;
                try {
                    const existing = await this.findOne(client, id);
                    orderNumber = existing.orderNumber ?? null;
                }
                catch {
                }
                failed.push({
                    id,
                    orderNumber,
                    error: err instanceof Error ? err.message : 'Confirm failed.',
                });
            }
        }
        return {
            requested: uniqueIds.length,
            confirmed: confirmed.length,
            failed: failed.length,
            confirmedOrders: confirmed,
            failures: failed,
        };
    }
    async cancelBulk(client, ids) {
        const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
        const cancelled = [];
        const failed = [];
        for (const id of uniqueIds) {
            try {
                const existing = await this.findOne(client, id);
                if (existing.status !== 'waiting_for_confirmation') {
                    failed.push({
                        id,
                        orderNumber: existing.orderNumber ?? null,
                        error: 'Only orders waiting for confirmation can be cancelled in bulk.',
                    });
                    continue;
                }
                const order = await this.cancel(client, id);
                cancelled.push({
                    id: order.id,
                    orderNumber: order.orderNumber,
                });
            }
            catch (err) {
                let orderNumber = null;
                try {
                    const existing = await this.findOne(client, id);
                    orderNumber = existing.orderNumber ?? null;
                }
                catch {
                }
                failed.push({
                    id,
                    orderNumber,
                    error: err instanceof Error ? err.message : 'Cancel failed.',
                });
            }
        }
        return {
            requested: uniqueIds.length,
            cancelled: cancelled.length,
            failed: failed.length,
            cancelledOrders: cancelled,
            failures: failed,
        };
    }
    async cancel(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.cancel(id, user);
    }
    async revertCancel(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.revertCancel(id, user);
    }
    async findOne(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const order = await this.omsOrders.findById(id, user);
        return stripClientCarrierCosts({
            ...order,
            trackingNumber: null,
            carrier: null,
            linkedOutboundOrder: order.linkedOutboundOrder
                ? {
                    ...order.linkedOutboundOrder,
                    trackingNumber: null,
                    shippingProviderCode: null,
                    shippingServiceId: null,
                }
                : order.linkedOutboundOrder,
        });
    }
    async getShippingMovement(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const result = await this.omsOrders.getShippingMovement(id, user);
        const { providerName: _providerName, providerCode: _providerCode, ...rest } = result;
        const brandPattern = /\b(sila(?:-sy)?(?:\.com)?|babel(?:\s*express)?|sena(?:\s*express)?|سينا|masarat|مسارات|بابيل|بابل|صلة|ترابط|logestechs|deliveroo(?:\s*joud)?|ديليفرو)\b/gi;
        const scrub = (value) => {
            if (typeof value !== 'string')
                return value;
            const cleaned = value.replace(brandPattern, '').replace(/\s{2,}/g, ' ').trim();
            return cleaned || value;
        };
        const events = Array.isArray(rest.events)
            ? rest.events.map((event) => ({
                ...event,
                title: scrub(event.title) ?? event.title,
                notes: scrub(event.notes) ?? event.notes,
            }))
            : rest.events;
        return {
            ...rest,
            events,
            statusLabel: scrub(rest.statusLabel) ?? rest.statusLabel,
            awb: null,
            providerName: null,
            providerCode: null,
        };
    }
    async timeline(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.timeline(id, user);
    }
    async codReport(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const createdAt = query.dateFrom || query.dateTo
            ? {
                ...(query.dateFrom
                    ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
                    : {}),
                ...(query.dateTo
                    ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
                    : {}),
            }
            : undefined;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [codRecords, legacyOrders] = await Promise.all([
                tx.codRecord.findMany({
                    where: {
                        companyId: client.companyId,
                        ...(createdAt
                            ? {
                                omsOrder: {
                                    paymentMethod: 'COD',
                                    createdAt,
                                    ...(query.storeChannel?.trim()
                                        ? {
                                            storeChannel: {
                                                contains: query.storeChannel.trim(),
                                                mode: 'insensitive',
                                            },
                                        }
                                        : {}),
                                },
                            }
                            : {
                                omsOrder: {
                                    paymentMethod: 'COD',
                                    ...(query.storeChannel?.trim()
                                        ? {
                                            storeChannel: {
                                                contains: query.storeChannel.trim(),
                                                mode: 'insensitive',
                                            },
                                        }
                                        : {}),
                                },
                            }),
                    },
                    include: {
                        adjustments: { select: { amount: true } },
                        omsOrder: {
                            select: {
                                id: true,
                                orderNumber: true,
                                status: true,
                                recipientName: true,
                                currency: true,
                                createdAt: true,
                                deliveredAt: true,
                                storeChannel: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                tx.omsOrder.findMany({
                    where: {
                        companyId: client.companyId,
                        paymentMethod: 'COD',
                        codRecord: null,
                        ...(createdAt ? { createdAt } : {}),
                        ...(query.storeChannel?.trim()
                            ? {
                                storeChannel: {
                                    contains: query.storeChannel.trim(),
                                    mode: 'insensitive',
                                },
                            }
                            : {}),
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        recipientName: true,
                        codAmount: true,
                        codStatus: true,
                        codCollectedAt: true,
                        codRemittedAt: true,
                        currency: true,
                        createdAt: true,
                        deliveredAt: true,
                    },
                }),
            ]);
            const rows = [];
            for (const rec of codRecords) {
                const adjSum = rec.adjustments.reduce((s, a) => s.add(a.amount), new client_1.Prisma.Decimal(0));
                const current = rec.originalAmount.add(adjSum);
                const portalStatus = (0, portal_cod_status_util_1.portalCodStatusFromRecord)(rec.status);
                rows.push({
                    id: rec.omsOrder.id,
                    orderNumber: rec.omsOrder.orderNumber,
                    status: rec.omsOrder.status,
                    recipientName: rec.omsOrder.recipientName,
                    codAmount: current.toString(),
                    codStatus: portalStatus,
                    codCollectedAt: rec.availableAt,
                    codRemittedAt: rec.paidOutAt,
                    currency: rec.currency ?? rec.omsOrder.currency,
                    createdAt: rec.omsOrder.createdAt,
                    deliveredAt: rec.omsOrder.deliveredAt,
                    codRecordId: rec.id,
                });
            }
            for (const order of legacyOrders) {
                rows.push({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    recipientName: order.recipientName,
                    codAmount: order.codAmount?.toString() ?? null,
                    codStatus: order.codStatus,
                    codCollectedAt: order.codCollectedAt,
                    codRemittedAt: order.codRemittedAt,
                    currency: order.currency,
                    createdAt: order.createdAt,
                    deliveredAt: order.deliveredAt,
                });
            }
            const filtered = rows.filter((r) => matchesPortalCodFilter(r.codStatus, query.codStatus));
            filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const total = filtered.length;
            const page = filtered.slice(query.offset, query.offset + query.limit);
            const totalCodAmount = filtered.reduce((sum, r) => {
                const n = Number(r.codAmount);
                return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
            const statusCounts = {
                all: rows.length,
                pending: rows.filter((r) => matchesPortalCodFilter(r.codStatus, 'pending')).length,
                collected: rows.filter((r) => matchesPortalCodFilter(r.codStatus, 'collected')).length,
                remitted: rows.filter((r) => matchesPortalCodFilter(r.codStatus, 'remitted')).length,
                settled: rows.filter((r) => matchesPortalCodFilter(r.codStatus, 'settled')).length,
                returned: rows.filter((r) => matchesPortalCodFilter(r.codStatus, 'returned')).length,
            };
            return {
                items: page,
                total,
                limit: query.limit,
                offset: query.offset,
                summary: {
                    orderCount: total,
                    totalCodAmount: String(totalCodAmount),
                    statusCounts,
                },
            };
        });
    }
    async exportCodReportXlsx(client, query) {
        const report = await this.codReport(client, {
            ...query,
            offset: 0,
            limit: 10_000,
        });
        const columns = [
            { header: 'Order #', key: 'orderNumber', width: 20 },
            { header: 'Recipient', key: 'recipientName', width: 25 },
            { header: 'COD Amount', key: 'codAmount', width: 16 },
            { header: 'Currency', key: 'currency', width: 12 },
            { header: 'COD Status', key: 'codStatus', width: 16 },
            { header: 'Created At', key: 'createdAt', width: 22 },
            { header: 'Delivered At', key: 'deliveredAt', width: 22 },
            { header: 'Collected At', key: 'codCollectedAt', width: 22 },
            { header: 'Remitted At', key: 'codRemittedAt', width: 22 },
        ];
        const rows = report.items.map((r) => ({
            orderNumber: r.orderNumber,
            recipientName: r.recipientName ?? '',
            codAmount: r.codAmount ?? '0',
            currency: r.currency ?? 'SYP',
            codStatus: r.codStatus ?? '',
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
            deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : '',
            codCollectedAt: r.codCollectedAt ? new Date(r.codCollectedAt).toISOString() : '',
            codRemittedAt: r.codRemittedAt ? new Date(r.codRemittedAt).toISOString() : '',
        }));
        const buffer = await (0, excel_export_util_1.buildExcelBuffer)({
            sheetName: 'COD Report',
            columns,
            rows,
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `cod-report-${stamp}.xlsx`,
            buffer,
            rowCount: report.items.length,
        };
    }
};
exports.ClientOmsOrdersService = ClientOmsOrdersService;
exports.ClientOmsOrdersService = ClientOmsOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        oms_orders_service_1.OmsOrdersService])
], ClientOmsOrdersService);
//# sourceMappingURL=client-oms-orders.service.js.map