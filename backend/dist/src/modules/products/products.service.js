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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const coerce_boolean_1 = require("../../common/utils/coerce-boolean");
const identifiers_1 = require("../../common/generators/identifiers");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const SKU_RETRY_LIMIT = 5;
const BARCODE_RETRY_LIMIT = 8;
const INTERNAL_ROLES = new Set([
    'super_admin',
    'wh_manager',
    'wh_operator',
    'finance',
]);
let ProductsService = class ProductsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async withProductCatalogRls(user, fn) {
        const isInternal = INTERNAL_ROLES.has(user.role);
        const companyCtx = isInternal ? '' : user.companyId ?? '';
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw(client_1.Prisma.sql `SELECT set_config('app.user_role', ${user.role}, true)`);
            await tx.$executeRaw(client_1.Prisma.sql `SELECT set_config('app.current_company_id', ${companyCtx}, true)`);
            return fn(tx);
        });
    }
    async allocateUniqueBarcode(companyId, tx) {
        const db = tx ?? this.prisma;
        for (let i = 0; i < BARCODE_RETRY_LIMIT; i++) {
            const candidate = (0, identifiers_1.generateBarcodeCandidate)();
            const exists = await db.product.findFirst({
                where: { companyId, barcode: candidate },
                select: { id: true },
            });
            if (!exists)
                return candidate;
        }
        return (0, identifiers_1.generateBarcodeCandidate)();
    }
    async create(user, dto) {
        const companyId = dto.companyId;
        const clientBarcode = dto.barcode?.trim();
        let lastError;
        const attempts = dto.sku?.trim() ? 1 : SKU_RETRY_LIMIT;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const sku = (dto.sku?.trim() ? dto.sku.trim() : (0, identifiers_1.generateSkuCandidate)()).toUpperCase();
            try {
                return await this.withProductCatalogRls(user, async (tx) => {
                    const barcode = clientBarcode || (await this.allocateUniqueBarcode(companyId, tx));
                    return tx.product.create({
                        data: {
                            companyId,
                            name: dto.name,
                            sku,
                            barcode,
                            description: dto.description,
                            trackingType: 'lot',
                            uom: dto.uom ?? 'piece',
                            expiryTracking: dto.expiryTracking ?? true,
                            minStockThreshold: dto.minStockThreshold ?? 0,
                            lengthCm: dto.lengthCm != null
                                ? new client_1.Prisma.Decimal(dto.lengthCm)
                                : undefined,
                            widthCm: dto.widthCm != null
                                ? new client_1.Prisma.Decimal(dto.widthCm)
                                : undefined,
                            heightCm: dto.heightCm != null
                                ? new client_1.Prisma.Decimal(dto.heightCm)
                                : undefined,
                            weightKg: dto.weightKg != null
                                ? new client_1.Prisma.Decimal(dto.weightKg)
                                : undefined,
                        },
                        include: { company: { select: { id: true, name: true } } },
                    });
                });
            }
            catch (err) {
                lastError = err;
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    err.code === 'P2002' &&
                    !dto.sku) {
                    continue;
                }
                throw err;
            }
        }
        throw lastError;
    }
    async list(user, query) {
        const includeArchived = (0, coerce_boolean_1.coerceOptionalBool)(query.includeArchived) === true;
        const where = {};
        if (!includeArchived) {
            where.status = { in: ['active', 'suspended'] };
        }
        if (query.companyId) {
            where.companyId = query.companyId;
        }
        const and = [];
        if (query.search?.trim()) {
            const q = query.search.trim();
            and.push({
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { sku: { contains: q, mode: 'insensitive' } },
                    { barcode: { contains: q, mode: 'insensitive' } },
                ],
            });
        }
        if (query.productName?.trim()) {
            and.push({
                name: { contains: query.productName.trim(), mode: 'insensitive' },
            });
        }
        if (query.sku?.trim()) {
            and.push({ sku: { contains: query.sku.trim(), mode: 'insensitive' } });
        }
        if (query.productBarcode?.trim()) {
            const b = query.productBarcode.trim();
            and.push({
                AND: [
                    { barcode: { not: null } },
                    { barcode: { contains: b, mode: 'insensitive' } },
                ],
            });
        }
        if (and.length)
            where.AND = and;
        return this.withProductCatalogRls(user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.product.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: query.limit,
                    skip: query.offset,
                    include: { company: { select: { id: true, name: true } } },
                }),
                tx.product.count({ where }),
            ]);
            const ids = items.map((p) => p.id);
            const sums = ids.length === 0
                ? []
                : await tx.currentStock.groupBy({
                    by: ['productId'],
                    where: { productId: { in: ids } },
                    _sum: { quantityOnHand: true, quantityReserved: true },
                });
            const sumByProduct = new Map(sums.map((s) => [
                s.productId,
                {
                    onHand: s._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0),
                    reserved: s._sum.quantityReserved ?? new client_1.Prisma.Decimal(0),
                },
            ]));
            const rows = items.map((p) => {
                const agg = sumByProduct.get(p.id);
                const onHand = agg?.onHand ?? new client_1.Prisma.Decimal(0);
                const reserved = agg?.reserved ?? new client_1.Prisma.Decimal(0);
                const stockZero = onHand.equals(0) && reserved.equals(0);
                return {
                    ...p,
                    totalOnHand: onHand.toString(),
                    totalReserved: reserved.toString(),
                    deletable: stockZero && p.status !== 'archived',
                };
            });
            return { items: rows, total, limit: query.limit, offset: query.offset };
        });
    }
    async findById(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { company: { select: { id: true, name: true } } },
        });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        return product;
    }
    async listLotsForProduct(productId) {
        await this.findById(productId);
        return this.prisma.lot.findMany({
            where: { productId },
            orderBy: { lotNumber: 'asc' },
            select: { id: true, lotNumber: true, expiryDate: true },
        });
    }
    async update(id, dto) {
        await this.findById(id);
        const data = {};
        if (dto.expiryTracking !== undefined)
            data.expiryTracking = dto.expiryTracking;
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.sku !== undefined)
            data.sku = dto.sku.trim().toUpperCase();
        if (dto.barcode !== undefined) {
            data.barcode = dto.barcode.trim() ? dto.barcode.trim() : null;
        }
        if (dto.description !== undefined) {
            data.description = dto.description?.trim()
                ? dto.description.trim()
                : null;
        }
        if (dto.uom !== undefined)
            data.uom = dto.uom;
        if (dto.minStockThreshold !== undefined) {
            data.minStockThreshold = dto.minStockThreshold;
        }
        if (dto.lengthCm !== undefined) {
            data.lengthCm =
                dto.lengthCm === null ? null : new client_1.Prisma.Decimal(dto.lengthCm);
        }
        if (dto.widthCm !== undefined) {
            data.widthCm =
                dto.widthCm === null ? null : new client_1.Prisma.Decimal(dto.widthCm);
        }
        if (dto.heightCm !== undefined) {
            data.heightCm =
                dto.heightCm === null ? null : new client_1.Prisma.Decimal(dto.heightCm);
        }
        if (dto.weightKg !== undefined) {
            data.weightKg =
                dto.weightKg === null ? null : new client_1.Prisma.Decimal(dto.weightKg);
        }
        if (Object.keys(data).length === 0) {
            return this.findById(id);
        }
        try {
            return await this.prisma.product.update({
                where: { id },
                data,
                include: { company: { select: { id: true, name: true } } },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('SKU already in use for this company.');
            }
            throw err;
        }
    }
    async softDelete(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        if (product.status === 'archived') {
            return this.findById(id);
        }
        const [stockSum, resSum, ledgerCount] = await this.prisma.$transaction([
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityOnHand: true },
            }),
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityReserved: true },
            }),
            this.prisma.inventoryLedger.count({ where: { productId: id } }),
        ]);
        const onHand = stockSum._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0);
        const reserved = resSum._sum.quantityReserved ?? new client_1.Prisma.Decimal(0);
        if (onHand.greaterThan(0) || reserved.greaterThan(0) || ledgerCount > 0) {
            throw new common_1.ConflictException('Cannot archive product while on-hand/reserved quantity or inventory history exists.');
        }
        return this.prisma.product.update({
            where: { id },
            data: { status: 'archived' },
            include: { company: { select: { id: true, name: true } } },
        });
    }
    async suspend(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        if (product.status !== 'active') {
            throw new common_1.BadRequestException('Only active products can be suspended.');
        }
        return this.prisma.product.update({
            where: { id },
            data: { status: 'suspended' },
            include: { company: { select: { id: true, name: true } } },
        });
    }
    async unsuspend(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        if (product.status !== 'suspended') {
            throw new common_1.BadRequestException('Only suspended products can be reactivated this way.');
        }
        return this.prisma.product.update({
            where: { id },
            data: { status: 'active' },
            include: { company: { select: { id: true, name: true } } },
        });
    }
    async removePermanentlyIfSafe(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        if (product.status === 'archived') {
            throw new common_1.BadRequestException('Archived products cannot be hard-deleted from this action.');
        }
        const [onHandAgg, resAgg, inboundLines, outboundLines, adjLines, ledger] = await this.prisma.$transaction([
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityOnHand: true },
            }),
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityReserved: true },
            }),
            this.prisma.inboundOrderLine.count({ where: { productId: id } }),
            this.prisma.outboundOrderLine.count({ where: { productId: id } }),
            this.prisma.stockAdjustmentLine.count({ where: { productId: id } }),
            this.prisma.inventoryLedger.count({ where: { productId: id } }),
        ]);
        const onHand = onHandAgg._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0);
        const reserved = resAgg._sum.quantityReserved ?? new client_1.Prisma.Decimal(0);
        if (onHand.greaterThan(0) || reserved.greaterThan(0)) {
            throw new common_1.ConflictException('Cannot delete product while on-hand or reserved quantity is greater than zero.');
        }
        if (inboundLines > 0 || outboundLines > 0 || adjLines > 0 || ledger > 0) {
            throw new common_1.ConflictException('Cannot delete product that appears on orders, adjustments, or inventory history. Archive it instead.');
        }
        await this.prisma.$transaction([
            this.prisma.currentStock.deleteMany({ where: { productId: id } }),
            this.prisma.lot.deleteMany({ where: { productId: id } }),
            this.prisma.product.delete({ where: { id } }),
        ]);
        return { id, deleted: true };
    }
    async nextSku(companyId) {
        for (let i = 0; i < SKU_RETRY_LIMIT; i++) {
            const candidate = (0, identifiers_1.generateSkuCandidate)();
            const taken = await this.prisma.product.findFirst({
                where: { companyId, sku: candidate },
                select: { id: true },
            });
            if (!taken)
                return { sku: candidate };
        }
        return { sku: (0, identifiers_1.generateSkuCandidate)() };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map