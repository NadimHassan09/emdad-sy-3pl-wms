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
exports.InventoryService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const storage_location_types_1 = require("../../common/constants/storage-location-types");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const location_operational_1 = require("../../common/utils/location-operational");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const realtime_service_1 = require("../realtime/realtime.service");
const realtime_ops_payload_1 = require("../realtime/realtime-ops.payload");
const ledger_mapper_1 = require("./ledger-mapper");
const stock_helpers_1 = require("./stock.helpers");
const stock_by_product_query_1 = require("./stock-by-product.query");
const ledger_list_query_1 = require("./ledger-list.query");
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEDGER_ROW_INCLUDE = {
    company: { select: { id: true, name: true } },
    product: { select: { id: true, sku: true, name: true } },
    lot: { select: { id: true, lotNumber: true } },
    operator: { select: { id: true, fullName: true } },
};
const BUSINESS_LEDGER_MOVEMENTS = [
    client_1.MovementType.inbound_receive,
    client_1.MovementType.outbound_pick,
    client_1.MovementType.adjustment_positive,
    client_1.MovementType.adjustment_negative,
];
function toBusinessMovementType(movementType) {
    if (movementType === client_1.MovementType.inbound_receive)
        return 'inbound';
    if (movementType === client_1.MovementType.outbound_pick)
        return 'outbound';
    return 'adjustment';
}
function businessGroupKey(row) {
    const parts = row.idempotencyKey?.split(':') ?? [];
    if (parts.length >= 4 && parts[0] === 'bm') {
        return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}`;
    }
    return `${row.referenceType}:${row.referenceId}:${row.productId}:${toBusinessMovementType(row.movementType)}:${row.id}`;
}
let InventoryService = class InventoryService {
    prisma;
    stockHelpers;
    companyAccess;
    audit;
    realtime;
    constructor(prisma, stockHelpers, companyAccess, audit, realtime) {
        this.prisma = prisma;
        this.stockHelpers = stockHelpers;
        this.companyAccess = companyAccess;
        this.audit = audit;
        this.realtime = realtime;
    }
    async appendInboundLedgerStockFilter(and, orderIds) {
        if (orderIds.length === 0) {
            and.push({ productId: { in: [] } });
            return;
        }
        const legs = await this.prisma.inventoryLedger.findMany({
            where: {
                referenceType: 'inbound_order',
                referenceId: { in: orderIds },
                movementType: 'inbound_receive',
                toLocationId: { not: null },
            },
            select: { productId: true, lotId: true, toLocationId: true },
        });
        const slices = new Map();
        for (const r of legs) {
            if (!r.toLocationId)
                continue;
            const k = `${r.productId}|${r.lotId ?? '__null'}|${r.toLocationId}`;
            slices.set(k, {
                productId: r.productId,
                locationId: r.toLocationId,
                lotId: r.lotId,
            });
        }
        const orSlices = [...slices.values()].map((s) => ({
            productId: s.productId,
            locationId: s.locationId,
            lotId: s.lotId,
        }));
        if (orSlices.length === 0) {
            and.push({ productId: { in: [] } });
        }
        else {
            and.push({ OR: orSlices });
        }
    }
    async resolveCurrentStockWhere(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        const and = [
            { quantityOnHand: { gt: 0 } },
        ];
        if (companyId) {
            and.push({ companyId });
        }
        if (query.productId)
            and.push({ productId: query.productId });
        if (query.warehouseId)
            and.push({ warehouseId: query.warehouseId });
        if (query.locationId) {
            and.push({ locationId: query.locationId });
        }
        else {
            const locRaw = query.locationBarcodeOrId?.trim();
            if (locRaw) {
                if (UUID_LIKE.test(locRaw)) {
                    and.push({ locationId: locRaw });
                }
                else {
                    and.push({
                        location: {
                            OR: [
                                { barcode: { contains: locRaw, mode: 'insensitive' } },
                                { fullPath: { contains: locRaw, mode: 'insensitive' } },
                            ],
                        },
                    });
                }
            }
        }
        if (query.packageId)
            and.push({ packageId: query.packageId });
        if (query.lotNumber?.trim()) {
            and.push({
                lot: {
                    lotNumber: { contains: query.lotNumber.trim(), mode: 'insensitive' },
                },
            });
        }
        if (query.sku?.trim()) {
            and.push({
                product: {
                    sku: { contains: query.sku.trim(), mode: 'insensitive' },
                },
            });
        }
        if (query.status) {
            and.push({ status: query.status });
        }
        if (query.productName?.trim()) {
            and.push({
                product: {
                    name: { contains: query.productName.trim(), mode: 'insensitive' },
                },
            });
        }
        if (query.productBarcode?.trim()) {
            const b = query.productBarcode.trim();
            and.push({
                product: {
                    AND: [{ barcode: { not: null } }, { barcode: { contains: b, mode: 'insensitive' } }],
                },
            });
        }
        if (query.productSearch?.trim()) {
            const q = query.productSearch.trim();
            and.push({
                product: {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { sku: { contains: q, mode: 'insensitive' } },
                    ],
                },
            });
        }
        if (query.inboundOrderId) {
            await this.appendInboundLedgerStockFilter(and, [query.inboundOrderId]);
        }
        else if (query.inboundOrderNumber?.trim()) {
            const term = query.inboundOrderNumber.trim();
            const whereOrd = {
                orderNumber: { contains: term, mode: 'insensitive' },
            };
            if (companyId)
                whereOrd.companyId = companyId;
            const orders = await this.prisma.inboundOrder.findMany({
                where: whereOrd,
                select: { id: true },
                take: 100,
            });
            await this.appendInboundLedgerStockFilter(and, orders.map((o) => o.id));
        }
        return and.length === 1 ? and[0] : { AND: and };
    }
    async stockByProductSummary(user, query) {
        const ctx = await (0, stock_by_product_query_1.buildStockByProductSqlContext)(this.prisma, this.companyAccess, user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [countRows, pageRows] = await Promise.all([
                tx.$queryRaw((0, stock_by_product_query_1.stockByProductCountSql)(ctx)),
                tx.$queryRaw((0, stock_by_product_query_1.stockByProductPageSql)(ctx, query.limit, query.offset)),
            ]);
            const total = countRows[0]?.total ?? 0;
            const items = pageRows.map((r) => ({
                productId: r.product_id,
                totalQuantity: r.total_quantity,
                onHand: r.total_quantity,
                reserved: r.reserved_quantity,
                available: r.available_quantity,
                product: {
                    id: r.product_id,
                    sku: r.sku,
                    name: r.name,
                    uom: r.uom,
                    barcode: r.barcode,
                },
                client: { id: r.company_id, name: r.company_name },
            }));
            return { items, total, limit: query.limit, offset: query.offset };
        });
    }
    async stock(user, query) {
        const where = await this.resolveCurrentStockWhere(user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total, agg] = await Promise.all([
                tx.currentStock.findMany({
                    where,
                    include: {
                        product: { select: { id: true, sku: true, name: true, uom: true } },
                        location: {
                            select: { id: true, name: true, fullPath: true, barcode: true },
                        },
                        warehouse: { select: { id: true, code: true, name: true } },
                        lot: { select: { id: true, lotNumber: true, expiryDate: true } },
                    },
                    orderBy: [{ lastMovementAt: 'desc' }],
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.currentStock.count({ where }),
                tx.currentStock.aggregate({
                    where,
                    _sum: {
                        quantityOnHand: true,
                        quantityReserved: true,
                        quantityAvailable: true,
                    },
                }),
            ]);
            return {
                items,
                total,
                limit: query.limit,
                offset: query.offset,
                totals: {
                    quantityOnHand: (agg._sum.quantityOnHand ?? 0).toString(),
                    quantityReserved: (agg._sum.quantityReserved ?? 0).toString(),
                    quantityAvailable: (agg._sum.quantityAvailable ?? 0).toString(),
                },
            };
        });
    }
    async ledger(user, query) {
        const ctx = await (0, ledger_list_query_1.buildLedgerListSqlContext)(this.prisma, this.companyAccess, user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [countRows, pageRows] = await Promise.all([
                tx.$queryRaw((0, ledger_list_query_1.ledgerBusinessGroupsCountSql)(ctx)),
                tx.$queryRaw((0, ledger_list_query_1.ledgerBusinessGroupPageSql)(ctx, query.limit, query.offset)),
            ]);
            const total = countRows[0]?.total ?? 0;
            const items = pageRows.map((row) => this.mapLedgerGroupPageRow(row));
            return { items, total, limit: query.limit, offset: query.offset };
        });
    }
    mapLedgerEntrySiblingRow(row) {
        return {
            id: row.id,
            createdAt: row.created_at,
            companyId: row.company_id,
            productId: row.product_id,
            lotId: row.lot_id,
            packageId: null,
            fromLocationId: row.from_location_id,
            toLocationId: row.to_location_id,
            movementType: row.movement_type,
            quantity: new client_1.Prisma.Decimal(row.quantity),
            quantityBefore: row.quantity_before != null ? new client_1.Prisma.Decimal(row.quantity_before) : null,
            quantityAfter: row.quantity_after != null ? new client_1.Prisma.Decimal(row.quantity_after) : null,
            referenceType: row.reference_type,
            referenceId: row.reference_id,
            operatorId: row.operator_id,
            idempotencyKey: row.idempotency_key,
            notes: row.notes,
            company: { id: row.company_id, name: row.company_name },
            product: { id: row.product_id, sku: row.product_sku, name: row.product_name },
            lot: row.lot_id ? { id: row.lot_id, lotNumber: row.lot_number ?? '' } : null,
            operator: { id: row.operator_id, fullName: row.operator_full_name },
        };
    }
    mapLedgerGroupPageRow(row) {
        const signedDelta = Number(row.signed_delta);
        const movementType = toBusinessMovementType(row.movement_type);
        const locCount = row.loc_count;
        return {
            id: row.id,
            createdAt: row.created_at,
            companyId: row.company_id,
            productId: row.product_id,
            lotId: row.lot_id,
            idempotencyKey: row.idempotency_key,
            company: { id: row.company_id, name: row.company_name },
            product: { id: row.product_id, sku: row.product_sku, name: row.product_name },
            lot: row.lot_id ? { id: row.lot_id, lotNumber: row.lot_number ?? '' } : null,
            operator: { id: row.operator_id, fullName: row.operator_full_name },
            movementType,
            referenceType: row.reference_type,
            referenceId: row.reference_id,
            quantity: new client_1.Prisma.Decimal(Math.abs(signedDelta)).toString(),
            quantityChange: signedDelta.toString(),
            quantityBefore: row.quantity_before != null ? new client_1.Prisma.Decimal(row.quantity_before).toString() : null,
            quantityAfter: row.quantity_after != null ? new client_1.Prisma.Decimal(row.quantity_after).toString() : null,
            fromLocationId: null,
            toLocationId: null,
            locationId: null,
            locationLabel: locCount > 1
                ? `${locCount} affected locations`
                : locCount === 1
                    ? '1 affected location'
                    : null,
            notes: row.notes,
        };
    }
    async ledgerEntry(user, query) {
        const createdAt = new Date(query.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
            throw new common_1.BadRequestException('Invalid createdAt.');
        }
        const head = await this.prisma.inventoryLedger.findUnique({
            where: { id_createdAt: { id: query.ledgerId, createdAt } },
            include: LEDGER_ROW_INCLUDE,
        });
        if (!head) {
            throw new common_1.NotFoundException('Ledger entry not found.');
        }
        this.companyAccess.validateResourceOwnership(user, head);
        const groupKey = businessGroupKey(head);
        const siblingRows = await this.prisma.$queryRaw((0, ledger_list_query_1.ledgerEntrySiblingRowsSql)({
            companyId: head.companyId,
            referenceType: head.referenceType,
            referenceId: head.referenceId,
            productId: head.productId,
            groupKey,
            warehouseId: query.warehouseId,
        }));
        const scopedRows = siblingRows.map((row) => this.mapLedgerEntrySiblingRow(row));
        if (scopedRows.length === 0) {
            throw new common_1.NotFoundException('Ledger entry not found in this warehouse.');
        }
        if (query.warehouseId && head.movementType === client_1.MovementType.inbound_receive) {
            const stockSlices = await this.prisma.currentStock.findMany({
                where: {
                    companyId: head.companyId,
                    warehouseId: query.warehouseId,
                    productId: head.productId,
                    lotId: head.lotId,
                    quantityOnHand: { gt: new client_1.Prisma.Decimal(0) },
                },
                select: { locationId: true, quantityOnHand: true },
                orderBy: { quantityOnHand: 'desc' },
            });
            if (stockSlices.length > 0) {
                const locs = await this.prisma.location.findMany({
                    where: { id: { in: [...new Set(stockSlices.map((s) => s.locationId))] } },
                    select: { id: true, name: true, fullPath: true, barcode: true },
                });
                const locMap = new Map(locs.map((l) => [l.id, l]));
                return {
                    lines: stockSlices.map((slice, idx) => {
                        const loc = locMap.get(slice.locationId);
                        const qty = slice.quantityOnHand.toString();
                        return {
                            id: `${head.id}:${idx}`,
                            createdAt: head.createdAt,
                            companyId: head.companyId,
                            productId: head.productId,
                            lotId: head.lotId,
                            idempotencyKey: head.idempotencyKey,
                            company: head.company,
                            product: head.product,
                            lot: head.lot,
                            operator: head.operator,
                            movementType: head.movementType,
                            referenceType: head.referenceType,
                            referenceId: head.referenceId,
                            quantity: qty,
                            quantityChange: qty,
                            quantityBefore: null,
                            quantityAfter: qty,
                            fromLocationId: null,
                            toLocationId: slice.locationId,
                            locationId: slice.locationId,
                            locationLabel: loc ? loc.fullPath || loc.name || loc.barcode : null,
                            notes: head.notes,
                        };
                    }),
                };
            }
        }
        const locMap = await this.buildLedgerLocationMap(scopedRows);
        return { lines: scopedRows.map((row) => this.formatLedgerRow(row, locMap)) };
    }
    async buildLedgerLocationMap(rows) {
        const locIds = new Set();
        for (const r of rows) {
            if (r.fromLocationId)
                locIds.add(r.fromLocationId);
            if (r.toLocationId)
                locIds.add(r.toLocationId);
        }
        if (locIds.size === 0)
            return new Map();
        const locs = await this.prisma.location.findMany({
            where: { id: { in: [...locIds] } },
            select: { id: true, name: true, fullPath: true, barcode: true },
        });
        return new Map(locs.map((l) => [l.id, l]));
    }
    formatLedgerRow(row, locMap) {
        const locationId = row.toLocationId ?? row.fromLocationId;
        const loc = locationId ? locMap.get(locationId) : undefined;
        const locationLabel = loc != null ? loc.fullPath || loc.name || loc.barcode : null;
        return {
            id: row.id,
            createdAt: row.createdAt,
            companyId: row.companyId,
            productId: row.productId,
            lotId: row.lotId,
            idempotencyKey: row.idempotencyKey,
            company: row.company,
            product: row.product,
            lot: row.lot,
            operator: row.operator,
            movementType: row.movementType,
            referenceType: row.referenceType,
            referenceId: row.referenceId,
            quantity: row.quantity.toString(),
            quantityChange: (0, ledger_mapper_1.ledgerSignedQuantity)(row.movementType, row.quantity),
            quantityBefore: row.quantityBefore?.toString() ?? null,
            quantityAfter: row.quantityAfter?.toString() ?? null,
            fromLocationId: row.fromLocationId,
            toLocationId: row.toLocationId,
            locationId,
            locationLabel,
            notes: row.notes,
        };
    }
    async internalTransfer(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        const qty = new client_1.Prisma.Decimal(dto.quantity.toString());
        if (qty.lte(0)) {
            throw new common_1.BadRequestException('quantity must be greater than zero.');
        }
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const product = await tx.product.findUnique({
                    where: { id: dto.productId },
                    select: { id: true, companyId: true, trackingType: true },
                });
                if (!product || product.companyId !== companyId) {
                    throw new common_1.BadRequestException('Product must belong to the selected client.');
                }
                let lotId = dto.lotId ?? null;
                if (product.trackingType === client_1.ProductTrackingType.lot) {
                    if (!lotId) {
                        throw new common_1.BadRequestException('lotId is required for lot-tracked products.');
                    }
                    const lot = await tx.lot.findUnique({
                        where: { id: lotId },
                        select: { id: true, productId: true },
                    });
                    if (!lot)
                        throw new common_1.NotFoundException('Lot not found.');
                    if (lot.productId !== product.id) {
                        throw new common_1.BadRequestException('Lot does not match product.');
                    }
                }
                else if (lotId) {
                    throw new common_1.BadRequestException('lotId must not be set for non-lot-tracked products.');
                }
                const fromLoc = await tx.location.findUnique({
                    where: { id: dto.fromLocationId },
                    select: { id: true, warehouseId: true, type: true, status: true },
                });
                const toLoc = await tx.location.findUnique({
                    where: { id: dto.toLocationId },
                    select: { id: true, warehouseId: true, type: true, status: true },
                });
                if (!fromLoc || !toLoc)
                    throw new common_1.NotFoundException('Location not found.');
                if (fromLoc.id === toLoc.id) {
                    throw new common_1.BadRequestException('Source and destination locations must differ.');
                }
                if (fromLoc.warehouseId !== toLoc.warehouseId) {
                    throw new common_1.BadRequestException('Internal transfer must stay within one warehouse.');
                }
                (0, location_operational_1.assertLocationUsableForInventoryMove)(fromLoc.status);
                (0, location_operational_1.assertLocationUsableForInventoryMove)(toLoc.status);
                if (!(0, storage_location_types_1.isAdjustmentStockLocationType)(fromLoc.type)) {
                    throw new common_1.BadRequestException('Source must be storage, fridge, quarantine, or scrap.');
                }
                if (!(0, storage_location_types_1.isAdjustmentStockLocationType)(toLoc.type)) {
                    throw new common_1.BadRequestException('Destination must be storage, fridge, quarantine, or scrap.');
                }
                const dec = await this.stockHelpers.decrementWithMeta(tx, {
                    companyId,
                    productId: dto.productId,
                    locationId: dto.fromLocationId,
                    lotId,
                    quantity: qty.toString(),
                });
                const inc = await this.stockHelpers.upsertPositiveWithMeta(tx, {
                    companyId,
                    productId: dto.productId,
                    locationId: dto.toLocationId,
                    warehouseId: toLoc.warehouseId,
                    lotId,
                    quantity: qty.toString(),
                });
                const referenceId = (0, node_crypto_1.randomUUID)();
                const ledgerRow = await tx.inventoryLedger.create({
                    data: {
                        companyId,
                        productId: dto.productId,
                        lotId,
                        fromLocationId: dto.fromLocationId,
                        toLocationId: dto.toLocationId,
                        movementType: 'internal_transfer',
                        quantity: qty,
                        quantityBefore: dec.before,
                        quantityAfter: inc.after,
                        referenceType: 'transfer',
                        referenceId,
                        operatorId: user.id,
                    },
                    include: LEDGER_ROW_INCLUDE,
                });
                const locMap = await this.buildLedgerLocationMap([ledgerRow]);
                await this.audit.logTx(tx, this.audit.fromPrincipal(user, {
                    action: 'INVENTORY_TRANSFERRED',
                    resourceType: 'inventory_transfer',
                    resourceId: referenceId,
                    companyId,
                    newState: {
                        productId: dto.productId,
                        fromLocationId: dto.fromLocationId,
                        toLocationId: dto.toLocationId,
                        lotId,
                        quantity: qty.toString(),
                        warehouseId: toLoc.warehouseId,
                    },
                }));
                return {
                    referenceId,
                    ledger: this.formatLedgerRow(ledgerRow, locMap),
                    companyId,
                    warehouseId: toLoc.warehouseId,
                    productId: dto.productId,
                    fromLocationId: dto.fromLocationId,
                    toLocationId: dto.toLocationId,
                    lotId,
                    quantity: qty.toString(),
                };
            });
            this.realtime.emitTransferCreated(result.companyId, (0, realtime_ops_payload_1.transferPayload)({ ...result, status: 'pending' }));
            this.realtime.emitTransferCompleted(result.companyId, (0, realtime_ops_payload_1.transferPayload)({ ...result, status: 'completed', ledger: result.ledger }));
            this.realtime.emitInventoryChanged(result.companyId, {
                source: 'internal_transfer',
                productId: result.productId,
            });
            return { referenceId: result.referenceId, ledger: result.ledger };
        }
        catch (e) {
            if (e instanceof domain_exceptions_1.InsufficientStockException) {
                throw new common_1.BadRequestException('Insufficient available quantity at the source location for this product/lot.');
            }
            throw e;
        }
    }
    async availability(user, productId, companyIdParam) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, companyIdParam);
        const agg = await this.prisma.currentStock.aggregate({
            where: { companyId, productId, status: 'available' },
            _sum: {
                quantityOnHand: true,
                quantityReserved: true,
                quantityAvailable: true,
            },
        });
        return {
            productId,
            companyId,
            onHand: (agg._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0)).toString(),
            reserved: (agg._sum.quantityReserved ?? new client_1.Prisma.Decimal(0)).toString(),
            available: (agg._sum.quantityAvailable ?? new client_1.Prisma.Decimal(0)).toString(),
        };
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers,
        company_access_service_1.CompanyAccessService,
        audit_log_service_1.AuditLogService,
        realtime_service_1.RealtimeService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map