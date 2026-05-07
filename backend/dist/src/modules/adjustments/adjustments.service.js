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
exports.AdjustmentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const storage_location_types_1 = require("../../common/constants/storage-location-types");
const location_operational_1 = require("../../common/utils/location-operational");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const create_adjustment_dto_1 = require("./dto/create-adjustment.dto");
const ADJUSTMENT_DETAIL_INCLUDE = {
    company: { select: { id: true, name: true } },
    warehouse: { select: { id: true, code: true, name: true } },
    creator: { select: { id: true, fullName: true } },
    approver: { select: { id: true, fullName: true } },
    lines: {
        include: {
            product: { select: { id: true, sku: true, name: true, barcode: true, uom: true } },
            location: {
                select: { id: true, name: true, fullPath: true, barcode: true },
            },
            lot: { select: { id: true, lotNumber: true } },
        },
        orderBy: { id: 'asc' },
    },
};
let AdjustmentsService = class AdjustmentsService {
    prisma;
    stock;
    constructor(prisma, stock) {
        this.prisma = prisma;
        this.stock = stock;
    }
    async create(user, dto) {
        const companyId = dto.companyId ?? user.companyId;
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required (no default company on current user).');
        }
        const wh = await this.prisma.warehouse.findUnique({
            where: { id: dto.warehouseId },
            select: { id: true },
        });
        if (!wh)
            throw new common_1.NotFoundException('Warehouse not found.');
        return this.prisma.stockAdjustment.create({
            data: {
                companyId,
                warehouseId: dto.warehouseId,
                reason: dto.reason?.trim() || create_adjustment_dto_1.ADJUSTMENT_REASON_PENDING,
                createdBy: user.id,
            },
            include: ADJUSTMENT_DETAIL_INCLUDE,
        });
    }
    async patch(user, id, dto) {
        const adj = await this.prisma.stockAdjustment.findUnique({ where: { id } });
        if (!adj)
            throw new common_1.NotFoundException('Adjustment not found.');
        if (adj.status !== 'draft') {
            throw new domain_exceptions_1.InvalidStateException('Only draft adjustments can be edited.');
        }
        if (user.companyId && adj.companyId !== user.companyId) {
            throw new common_1.NotFoundException('Adjustment not found.');
        }
        return this.prisma.stockAdjustment.update({
            where: { id },
            data: { reason: dto.reason.trim(), updatedAt: new Date() },
            include: ADJUSTMENT_DETAIL_INCLUDE,
        });
    }
    list(user, query) {
        const where = {};
        const companyId = query.companyId ?? user.companyId ?? undefined;
        if (companyId)
            where.companyId = companyId;
        if (query.status)
            where.status = query.status;
        if (query.warehouseId)
            where.warehouseId = query.warehouseId;
        if (query.adjustmentId)
            where.id = query.adjustmentId;
        if (query.productId || query.lotId) {
            where.lines = {
                some: {
                    ...(query.productId ? { productId: query.productId } : {}),
                    ...(query.lotId ? { lotId: query.lotId } : {}),
                },
            };
        }
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
            if (query.createdTo)
                createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
            where.createdAt = createdAt;
        }
        return this.prisma.$transaction([
            this.prisma.stockAdjustment.findMany({
                where,
                include: ADJUSTMENT_DETAIL_INCLUDE,
                orderBy: { createdAt: 'desc' },
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.stockAdjustment.count({ where }),
        ]).then(([items, total]) => ({
            items,
            total,
            limit: query.limit,
            offset: query.offset,
        }));
    }
    async findById(id) {
        const row = await this.prisma.stockAdjustment.findUnique({
            where: { id },
            include: ADJUSTMENT_DETAIL_INCLUDE,
        });
        if (!row)
            throw new common_1.NotFoundException('Adjustment not found.');
        return row;
    }
    async addLine(_user, adjustmentId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const adj = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } });
            if (!adj)
                throw new common_1.NotFoundException('Adjustment not found.');
            if (adj.status !== 'draft') {
                throw new domain_exceptions_1.InvalidStateException('Lines can only be added while adjustment is draft.');
            }
            const product = await tx.product.findUnique({ where: { id: dto.productId } });
            if (!product || product.companyId !== adj.companyId) {
                throw new common_1.BadRequestException('Product must belong to the adjustment company.');
            }
            const location = await tx.location.findUnique({
                where: { id: dto.locationId },
                select: { id: true, warehouseId: true, type: true, status: true },
            });
            if (!location)
                throw new common_1.NotFoundException('Location not found.');
            (0, location_operational_1.assertLocationUsableForInventoryMove)(location.status);
            if (location.warehouseId !== adj.warehouseId) {
                throw new common_1.BadRequestException('Location must belong to the adjustment warehouse.');
            }
            if (!(0, storage_location_types_1.isAdjustmentStockLocationType)(location.type)) {
                throw new common_1.BadRequestException('Pick a storage, fridge, quarantine, or scrap location for this adjustment.');
            }
            if (product.trackingType === 'lot') {
                if (!dto.lotId) {
                    throw new common_1.BadRequestException('lotId is required for lot-tracked products — select an existing lot.');
                }
                const lot = await tx.lot.findUnique({
                    where: { id: dto.lotId },
                    select: { id: true, productId: true },
                });
                if (!lot)
                    throw new common_1.NotFoundException('Lot not found.');
                if (lot.productId !== dto.productId) {
                    throw new common_1.BadRequestException('Lot does not match product.');
                }
            }
            else if (dto.lotId) {
                throw new common_1.BadRequestException('lotId must not be set for non-lot-tracked products.');
            }
            const before = await this.stock.readOnHandForUpdate(tx, {
                companyId: adj.companyId,
                productId: dto.productId,
                locationId: dto.locationId,
                lotId: dto.lotId ?? null,
            });
            await tx.stockAdjustmentLine.create({
                data: {
                    adjustmentId,
                    productId: dto.productId,
                    locationId: dto.locationId,
                    lotId: dto.lotId,
                    quantityBefore: before,
                    quantityAfter: new client_1.Prisma.Decimal(dto.quantityAfter),
                },
            });
            return tx.stockAdjustment.findUniqueOrThrow({
                where: { id: adjustmentId },
                include: ADJUSTMENT_DETAIL_INCLUDE,
            });
        });
    }
    async patchLine(adjustmentId, lineId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const adj = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } });
            if (!adj)
                throw new common_1.NotFoundException('Adjustment not found.');
            if (adj.status !== 'draft') {
                throw new domain_exceptions_1.InvalidStateException('Lines can only be edited while adjustment is draft.');
            }
            const line = await tx.stockAdjustmentLine.findUnique({ where: { id: lineId } });
            if (!line || line.adjustmentId !== adjustmentId) {
                throw new common_1.NotFoundException('Adjustment line not found.');
            }
            const data = {};
            if (dto.quantityAfter !== undefined) {
                data.quantityAfter = dto.quantityAfter;
            }
            if (dto.reasonNote !== undefined) {
                data.reasonNote = dto.reasonNote;
            }
            if (Object.keys(data).length === 0) {
                return tx.stockAdjustment.findUniqueOrThrow({
                    where: { id: adjustmentId },
                    include: ADJUSTMENT_DETAIL_INCLUDE,
                });
            }
            await tx.stockAdjustmentLine.update({
                where: { id: lineId },
                data,
            });
            return tx.stockAdjustment.findUniqueOrThrow({
                where: { id: adjustmentId },
                include: ADJUSTMENT_DETAIL_INCLUDE,
            });
        });
    }
    async approve(user, id) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const adj = await tx.stockAdjustment.findUnique({
                    where: { id },
                    include: { lines: true },
                });
                if (!adj)
                    throw new common_1.NotFoundException('Adjustment not found.');
                if (adj.status !== 'draft') {
                    throw new domain_exceptions_1.InvalidStateException(`Only draft adjustments can be approved (current: ${adj.status}).`);
                }
                const reasonTrim = adj.reason?.trim() ?? '';
                if (!reasonTrim || reasonTrim === create_adjustment_dto_1.ADJUSTMENT_REASON_PENDING) {
                    throw new common_1.BadRequestException('Set an adjustment reason in the draft form before approving.');
                }
                if (adj.lines.length === 0) {
                    throw new common_1.BadRequestException('Cannot approve an adjustment with no lines.');
                }
                for (const line of adj.lines) {
                    const actual = await this.stock.readOnHandForUpdate(tx, {
                        companyId: adj.companyId,
                        productId: line.productId,
                        locationId: line.locationId,
                        lotId: line.lotId,
                    });
                    await tx.stockAdjustmentLine.update({
                        where: { id: line.id },
                        data: { quantityBefore: actual },
                    });
                }
                await tx.stockAdjustment.update({
                    where: { id },
                    data: {
                        status: 'approved',
                        approvedBy: user.id,
                        approvedAt: new Date(),
                    },
                });
                const lines = await tx.stockAdjustmentLine.findMany({
                    where: { adjustmentId: id },
                });
                for (const line of lines) {
                    const before = new client_1.Prisma.Decimal(line.quantityBefore.toString());
                    const after = new client_1.Prisma.Decimal(line.quantityAfter.toString());
                    const delta = after.minus(before);
                    if (delta.equals(0))
                        continue;
                    if (delta.greaterThan(0)) {
                        const meta = await this.stock.upsertPositiveWithMeta(tx, {
                            companyId: adj.companyId,
                            productId: line.productId,
                            locationId: line.locationId,
                            warehouseId: adj.warehouseId,
                            lotId: line.lotId,
                            quantity: delta.toString(),
                        });
                        await tx.inventoryLedger.create({
                            data: {
                                companyId: adj.companyId,
                                productId: line.productId,
                                lotId: line.lotId,
                                toLocationId: line.locationId,
                                movementType: 'adjustment_positive',
                                quantity: delta,
                                quantityBefore: meta.before,
                                quantityAfter: meta.after,
                                referenceType: 'adjustment',
                                referenceId: id,
                                operatorId: user.id,
                            },
                        });
                    }
                    else {
                        const take = delta.abs();
                        const meta = await this.stock.decrementWithMeta(tx, {
                            companyId: adj.companyId,
                            productId: line.productId,
                            locationId: line.locationId,
                            lotId: line.lotId,
                            quantity: take.toString(),
                        });
                        await tx.inventoryLedger.create({
                            data: {
                                companyId: adj.companyId,
                                productId: line.productId,
                                lotId: line.lotId,
                                fromLocationId: line.locationId,
                                movementType: 'adjustment_negative',
                                quantity: take,
                                quantityBefore: meta.before,
                                quantityAfter: meta.after,
                                referenceType: 'adjustment',
                                referenceId: id,
                                operatorId: user.id,
                            },
                        });
                    }
                }
                return tx.stockAdjustment.findUniqueOrThrow({
                    where: { id },
                    include: ADJUSTMENT_DETAIL_INCLUDE,
                });
            });
        }
        catch (e) {
            if (e instanceof Error &&
                e.message.includes('does not match actual stock')) {
                throw new common_1.ConflictException('Stock no longer matches the adjustment snapshot — concurrent modification detected.');
            }
            throw e;
        }
    }
    async cancel(id) {
        const adj = await this.prisma.stockAdjustment.findUnique({ where: { id } });
        if (!adj)
            throw new common_1.NotFoundException('Adjustment not found.');
        if (adj.status !== 'draft') {
            throw new domain_exceptions_1.InvalidStateException('Only draft adjustments can be cancelled.');
        }
        return this.prisma.stockAdjustment.update({
            where: { id },
            data: { status: 'cancelled' },
            include: ADJUSTMENT_DETAIL_INCLUDE,
        });
    }
};
exports.AdjustmentsService = AdjustmentsService;
exports.AdjustmentsService = AdjustmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers])
], AdjustmentsService);
//# sourceMappingURL=adjustments.service.js.map