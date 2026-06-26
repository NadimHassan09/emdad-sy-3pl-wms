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
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const identifiers_1 = require("../../common/generators/identifiers");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_service_1 = require("../realtime/realtime.service");
const billing_access_service_1 = require("../billing/billing-access.service");
const realtime_master_data_payload_1 = require("../realtime/realtime-master-data.payload");
const product_audit_util_1 = require("./product-audit.util");
const product_barcode_util_1 = require("./product-barcode.util");
const product_delete_references_util_1 = require("./product-delete-references.util");
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
    companyAccess;
    audit;
    realtime;
    billingAccess;
    constructor(prisma, companyAccess, audit, realtime, billingAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.audit = audit;
        this.realtime = realtime;
        this.billingAccess = billingAccess;
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
            try {
                await (0, product_barcode_util_1.assertCompanyBarcodeAvailable)(db, companyId, candidate);
                return candidate;
            }
            catch (err) {
                if (!(err instanceof common_1.ConflictException))
                    throw err;
            }
        }
        return (0, identifiers_1.generateBarcodeCandidate)();
    }
    async create(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.billingAccess.assertOperationalBilling(companyId);
        const clientBarcode = (0, product_barcode_util_1.normalizeProductBarcode)(dto.barcode);
        let lastError;
        const attempts = dto.sku?.trim() ? 1 : SKU_RETRY_LIMIT;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const sku = (dto.sku?.trim() ? dto.sku.trim() : (0, identifiers_1.generateSkuCandidate)()).toUpperCase();
            try {
                const created = await this.withProductCatalogRls(user, async (tx) => {
                    if (clientBarcode) {
                        await (0, product_barcode_util_1.assertCompanyBarcodeAvailable)(tx, companyId, clientBarcode);
                    }
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
                await this.audit.log(this.audit.fromPrincipal(user, {
                    action: 'PRODUCT_CREATED',
                    resourceType: 'product',
                    resourceId: created.id,
                    companyId: created.companyId,
                    newState: (0, product_audit_util_1.productAuditSnapshot)(created),
                }));
                this.realtime.emitProductCreated(created.companyId, (0, realtime_master_data_payload_1.productRealtimePayload)(created));
                return created;
            }
            catch (err) {
                lastError = err;
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    err.code === 'P2002' &&
                    !dto.sku) {
                    const target = Array.isArray(err.meta?.target)
                        ? err.meta.target
                        : [];
                    if (!target.some((f) => f.includes('barcode'))) {
                        continue;
                    }
                }
                this.throwUniqueViolation(err);
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
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId) {
            where.companyId = companyId;
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
            const referencedProductIds = new Set();
            if (ids.length > 0) {
                const [inboundRefs, outboundRefs, adjustmentRefs, ledgerRefs] = await Promise.all([
                    tx.inboundOrderLine.groupBy({
                        by: ['productId'],
                        where: (0, product_delete_references_util_1.inboundLinesBlockingProductDeleteWhere)(ids),
                    }),
                    tx.outboundOrderLine.groupBy({
                        by: ['productId'],
                        where: (0, product_delete_references_util_1.outboundLinesBlockingProductDeleteWhere)(ids),
                    }),
                    tx.stockAdjustmentLine.groupBy({
                        by: ['productId'],
                        where: { productId: { in: ids } },
                    }),
                    tx.inventoryLedger.groupBy({
                        by: ['productId'],
                        where: { productId: { in: ids } },
                    }),
                ]);
                for (const row of [
                    ...inboundRefs,
                    ...outboundRefs,
                    ...adjustmentRefs,
                    ...ledgerRefs,
                ]) {
                    referencedProductIds.add(row.productId);
                }
            }
            const rows = items.map((p) => {
                const agg = sumByProduct.get(p.id);
                const onHand = agg?.onHand ?? new client_1.Prisma.Decimal(0);
                const reserved = agg?.reserved ?? new client_1.Prisma.Decimal(0);
                const stockZero = onHand.equals(0) && reserved.equals(0);
                const hasReferences = referencedProductIds.has(p.id);
                return {
                    ...p,
                    totalOnHand: onHand.toString(),
                    totalReserved: reserved.toString(),
                    deletable: stockZero && !hasReferences && p.status !== 'archived',
                    archivable: stockZero && p.status !== 'archived',
                };
            });
            return { items: rows, total, limit: query.limit, offset: query.offset };
        });
    }
    async findById(id, user) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { company: { select: { id: true, name: true } } },
        });
        if (!product)
            throw new common_1.NotFoundException('Product not found.');
        this.companyAccess.validateResourceOwnership(user, product);
        return product;
    }
    async listLotsForProduct(productId, user) {
        await this.findById(productId, user);
        return this.prisma.lot.findMany({
            where: { productId },
            orderBy: { lotNumber: 'asc' },
            select: { id: true, lotNumber: true, expiryDate: true },
        });
    }
    async update(id, dto, user) {
        const product = await this.findById(id, user);
        const data = {};
        if (dto.expiryTracking !== undefined)
            data.expiryTracking = dto.expiryTracking;
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.sku !== undefined)
            data.sku = dto.sku.trim().toUpperCase();
        let nextBarcode;
        if (dto.barcode !== undefined) {
            nextBarcode = (0, product_barcode_util_1.normalizeProductBarcode)(dto.barcode);
            if ((0, product_barcode_util_1.barcodeChanged)(product.barcode, nextBarcode)) {
                if (nextBarcode) {
                    await (0, product_barcode_util_1.assertCompanyBarcodeAvailable)(this.prisma, product.companyId, nextBarcode, id);
                }
            }
            data.barcode = nextBarcode;
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
            return this.findById(id, user);
        }
        const previousState = (0, product_audit_util_1.productAuditSnapshot)(product);
        try {
            const updated = await this.prisma.product.update({
                where: { id },
                data,
                include: { company: { select: { id: true, name: true } } },
            });
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'PRODUCT_UPDATED',
                resourceType: 'product',
                resourceId: updated.id,
                companyId: updated.companyId,
                previousState,
                newState: (0, product_audit_util_1.productAuditSnapshot)(updated),
            }));
            this.realtime.emitProductUpdated(updated.companyId, (0, realtime_master_data_payload_1.productRealtimePayload)(updated));
            return updated;
        }
        catch (err) {
            this.throwUniqueViolation(err);
        }
    }
    throwUniqueViolation(err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002') {
            const target = Array.isArray(err.meta?.target)
                ? err.meta.target
                : [];
            if (target.some((f) => f.includes('barcode'))) {
                throw new common_1.ConflictException('Barcode already in use for an active product in this company.');
            }
            throw new common_1.ConflictException('SKU already in use for this company.');
        }
        throw err;
    }
    async softDelete(id, user) {
        const product = await this.findById(id, user);
        if (product.status === 'archived') {
            return this.findById(id, user);
        }
        const [stockSum, resSum] = await this.prisma.$transaction([
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityOnHand: true },
            }),
            this.prisma.currentStock.aggregate({
                where: { productId: id },
                _sum: { quantityReserved: true },
            }),
        ]);
        const onHand = stockSum._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0);
        const reserved = resSum._sum.quantityReserved ?? new client_1.Prisma.Decimal(0);
        if (onHand.greaterThan(0) || reserved.greaterThan(0)) {
            throw new common_1.ConflictException('Cannot archive product while on-hand or reserved quantity is greater than zero.');
        }
        const archived = await this.prisma.product.update({
            where: { id },
            data: { status: 'archived' },
            include: { company: { select: { id: true, name: true } } },
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'PRODUCT_ARCHIVED',
            resourceType: 'product',
            resourceId: archived.id,
            companyId: archived.companyId,
            previousState: (0, product_audit_util_1.productAuditSnapshot)(product),
            newState: (0, product_audit_util_1.productAuditSnapshot)(archived),
        }));
        this.realtime.emitProductArchived(archived.companyId, archived.id);
        return archived;
    }
    async suspend(id, user) {
        const product = await this.findById(id, user);
        if (product.status !== 'active') {
            throw new common_1.BadRequestException('Only active products can be suspended.');
        }
        const updated = await this.prisma.product.update({
            where: { id },
            data: { status: 'suspended' },
            include: { company: { select: { id: true, name: true } } },
        });
        this.realtime.emitProductUpdated(updated.companyId, (0, realtime_master_data_payload_1.productRealtimePayload)(updated));
        return updated;
    }
    async unsuspend(id, user) {
        const product = await this.findById(id, user);
        if (product.status !== 'suspended') {
            throw new common_1.BadRequestException('Only suspended products can be reactivated this way.');
        }
        if (product.barcode) {
            await (0, product_barcode_util_1.assertCompanyBarcodeAvailable)(this.prisma, product.companyId, product.barcode, id);
        }
        try {
            const updated = await this.prisma.product.update({
                where: { id },
                data: { status: 'active' },
                include: { company: { select: { id: true, name: true } } },
            });
            this.realtime.emitProductUpdated(updated.companyId, (0, realtime_master_data_payload_1.productRealtimePayload)(updated));
            return updated;
        }
        catch (err) {
            this.throwUniqueViolation(err);
        }
    }
    async removePermanentlyIfSafe(id, user) {
        const product = await this.findById(id, user);
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
            this.prisma.inboundOrderLine.count({
                where: (0, product_delete_references_util_1.inboundLinesBlockingProductDeleteWhere)(id),
            }),
            this.prisma.outboundOrderLine.count({
                where: (0, product_delete_references_util_1.outboundLinesBlockingProductDeleteWhere)(id),
            }),
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
        await this.prisma.$transaction(async (tx) => {
            await (0, product_delete_references_util_1.purgeRemovableOrderLinesForProduct)(tx, id);
            await tx.currentStock.deleteMany({ where: { productId: id } });
            await tx.lot.deleteMany({ where: { productId: id } });
            await tx.product.delete({ where: { id } });
        });
        this.realtime.emitProductDeleted(product.companyId, id);
        return { id, deleted: true };
    }
    async nextSku(user, companyIdParam) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, companyIdParam);
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        audit_log_service_1.AuditLogService,
        realtime_service_1.RealtimeService,
        billing_access_service_1.BillingAccessService])
], ProductsService);
//# sourceMappingURL=products.service.js.map