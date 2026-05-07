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
const storage_location_types_1 = require("../../common/constants/storage-location-types");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const location_operational_1 = require("../../common/utils/location-operational");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const ledger_mapper_1 = require("./ledger-mapper");
const stock_helpers_1 = require("./stock.helpers");
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEDGER_ROW_INCLUDE = {
    company: { select: { id: true, name: true } },
    product: { select: { id: true, sku: true, name: true } },
    lot: { select: { id: true, lotNumber: true } },
    operator: { select: { id: true, fullName: true } },
};
let InventoryService = class InventoryService {
    prisma;
    stockHelpers;
    constructor(prisma, stockHelpers) {
        this.prisma = prisma;
        this.stockHelpers = stockHelpers;
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
        const companyId = query.companyId ?? user.companyId ?? undefined;
        const and = [
            { quantityOnHand: { gt: 0 } },
        ];
        if (companyId)
            and.push({ companyId });
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
        const where = await this.resolveCurrentStockWhere(user, query);
        const grouped = await this.prisma.currentStock.groupBy({
            by: ['productId'],
            where,
            _sum: { quantityOnHand: true },
        });
        const productIds = grouped.map((g) => g.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { company: { select: { id: true, name: true } } },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        const rows = grouped
            .map((g) => {
            const p = productMap.get(g.productId);
            if (!p)
                return null;
            const sum = g._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0);
            return {
                productId: g.productId,
                totalQuantity: sum.toString(),
                product: {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    uom: p.uom,
                    barcode: p.barcode,
                },
                client: { id: p.companyId, name: p.company.name },
            };
        })
            .filter((r) => r != null)
            .sort((a, b) => a.product.name.localeCompare(b.product.name));
        const total = rows.length;
        const items = rows.slice(query.offset, query.offset + query.limit);
        return { items, total, limit: query.limit, offset: query.offset };
    }
    async stock(user, query) {
        const where = await this.resolveCurrentStockWhere(user, query);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.currentStock.findMany({
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
            this.prisma.currentStock.count({ where }),
        ]);
        return { items, total, limit: query.limit, offset: query.offset };
    }
    async ledger(user, query) {
        const andParts = [];
        const companyId = query.companyId ?? user.companyId ?? undefined;
        if (companyId)
            andParts.push({ companyId });
        if (query.productId)
            andParts.push({ productId: query.productId });
        if (query.movementType)
            andParts.push({ movementType: query.movementType });
        if (query.referenceType)
            andParts.push({ referenceType: query.referenceType });
        if (query.referenceId)
            andParts.push({ referenceId: query.referenceId });
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
            if (query.createdTo)
                createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
            andParts.push({ createdAt });
        }
        if (query.warehouseId) {
            const warehouseLocs = await this.prisma.location.findMany({
                where: { warehouseId: query.warehouseId, status: 'active' },
                select: { id: true },
            });
            const locList = warehouseLocs.map((l) => l.id);
            const whPiece = locList.length === 0
                ? { fromLocationId: { in: [] } }
                : {
                    OR: [
                        { fromLocationId: { in: locList } },
                        { toLocationId: { in: locList } },
                    ],
                };
            andParts.push(whPiece);
        }
        const where = andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0] : { AND: andParts };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.inventoryLedger.findMany({
                where,
                include: LEDGER_ROW_INCLUDE,
                orderBy: { createdAt: 'desc' },
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.inventoryLedger.count({ where }),
        ]);
        const locMap = await this.buildLedgerLocationMap(rows);
        const items = rows.map((row) => this.formatLedgerRow(row, locMap));
        return { items, total, limit: query.limit, offset: query.offset };
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
        if (user.companyId && head.companyId !== user.companyId) {
            throw new common_1.NotFoundException('Ledger entry not found.');
        }
        let rows = head.idempotencyKey
            ? await this.prisma.inventoryLedger.findMany({
                where: { companyId: head.companyId, idempotencyKey: head.idempotencyKey },
                include: LEDGER_ROW_INCLUDE,
                orderBy: { createdAt: 'asc' },
            })
            : [head];
        if (query.warehouseId) {
            const warehouseLocs = await this.prisma.location.findMany({
                where: { warehouseId: query.warehouseId, status: 'active' },
                select: { id: true },
            });
            const locSet = new Set(warehouseLocs.map((l) => l.id));
            rows = rows.filter((r) => (r.fromLocationId != null && locSet.has(r.fromLocationId)) ||
                (r.toLocationId != null && locSet.has(r.toLocationId)));
        }
        if (rows.length === 0) {
            throw new common_1.NotFoundException('Ledger entry not found in this warehouse.');
        }
        const locMap = await this.buildLedgerLocationMap(rows);
        return { lines: rows.map((row) => this.formatLedgerRow(row, locMap)) };
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
        const locationId = row.fromLocationId ?? row.toLocationId;
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
        const companyId = dto.companyId ?? user.companyId ?? undefined;
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required (set X-Company-Id, pass companyId, or use a client-scoped user).');
        }
        if (user.companyId && companyId !== user.companyId) {
            throw new common_1.NotFoundException('Company not found.');
        }
        const qty = new client_1.Prisma.Decimal(dto.quantity.toString());
        if (qty.lte(0)) {
            throw new common_1.BadRequestException('quantity must be greater than zero.');
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
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
                return {
                    referenceId,
                    ledger: this.formatLedgerRow(ledgerRow, locMap),
                };
            });
        }
        catch (e) {
            if (e instanceof domain_exceptions_1.InsufficientStockException) {
                throw new common_1.BadRequestException('Insufficient available quantity at the source location for this product/lot.');
            }
            throw e;
        }
    }
    async availability(user, productId, companyIdParam) {
        const companyId = companyIdParam ?? user.companyId;
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required.');
        }
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
        stock_helpers_1.StockHelpers])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map