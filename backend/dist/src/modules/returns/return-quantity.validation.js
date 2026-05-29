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
exports.ReturnQuantityValidation = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const returns_constants_1 = require("./returns.constants");
let ReturnQuantityValidation = class ReturnQuantityValidation {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    client(tx) {
        return tx ?? this.prisma;
    }
    async getOutboundReturnQuota(originalOutboundOrderId, excludeReturnOrderId, tx) {
        const outbound = await this.client(tx).outboundOrder.findUnique({
            where: { id: originalOutboundOrderId },
            include: {
                lines: {
                    select: {
                        id: true,
                        productId: true,
                        pickedQuantity: true,
                        product: { select: { sku: true } },
                    },
                    orderBy: { lineNumber: 'asc' },
                },
            },
        });
        if (!outbound) {
            throw new common_1.NotFoundException('Original outbound order not found.');
        }
        if (outbound.status !== client_1.OutboundOrderStatus.shipped) {
            throw new common_1.BadRequestException('Return quota is only available for shipped outbound orders.');
        }
        const quotaLines = [];
        for (const line of outbound.lines) {
            const alreadyReturned = await this.sumActiveReturnQuantity(originalOutboundOrderId, `line:${line.id}`, excludeReturnOrderId, tx);
            const remaining = client_1.Prisma.Decimal.max(line.pickedQuantity.sub(alreadyReturned), new client_1.Prisma.Decimal(0));
            quotaLines.push({
                outboundOrderLineId: line.id,
                productId: line.productId,
                sku: line.product.sku,
                shippedQuantity: line.pickedQuantity.toString(),
                alreadyReturned: alreadyReturned.toString(),
                remaining: remaining.toString(),
            });
        }
        return {
            outboundOrderId: outbound.id,
            orderNumber: outbound.orderNumber,
            status: outbound.status,
            lines: quotaLines,
        };
    }
    async assertWithinShippedLimits(originalOutboundOrderId, lines, excludeReturnOrderId, tx) {
        const outbound = await this.client(tx).outboundOrder.findUnique({
            where: { id: originalOutboundOrderId },
            include: {
                lines: {
                    select: {
                        id: true,
                        productId: true,
                        specificLotId: true,
                        pickedQuantity: true,
                    },
                },
            },
        });
        if (!outbound) {
            throw new common_1.NotFoundException('Original outbound order not found.');
        }
        if (outbound.status !== client_1.OutboundOrderStatus.shipped) {
            throw new common_1.BadRequestException('Returns linked to an outbound order require that order to be in shipped status.');
        }
        const outboundLineById = new Map(outbound.lines.map((l) => [l.id, l]));
        const buckets = new Map();
        for (const line of lines) {
            if (line.expectedQuantity.lte(0)) {
                throw new common_1.BadRequestException('Return line expected quantity must be positive.');
            }
            let max;
            let bucketKey;
            if (line.outboundOrderLineId) {
                const obLine = outboundLineById.get(line.outboundOrderLineId);
                if (!obLine) {
                    throw new common_1.BadRequestException('outboundOrderLineId does not belong to the linked outbound order.');
                }
                if (obLine.productId !== line.productId) {
                    throw new common_1.BadRequestException('Return line product does not match the referenced outbound line.');
                }
                if (line.lotId && obLine.specificLotId && obLine.specificLotId !== line.lotId) {
                    throw new common_1.BadRequestException('Return line lot does not match the referenced outbound line lot.');
                }
                max = obLine.pickedQuantity;
                bucketKey = `line:${line.outboundOrderLineId}`;
            }
            else {
                const matching = outbound.lines.filter((l) => {
                    if (l.productId !== line.productId)
                        return false;
                    if (line.lotId && l.specificLotId && l.specificLotId !== line.lotId)
                        return false;
                    return true;
                });
                if (matching.length === 0) {
                    throw new common_1.BadRequestException('No matching outbound line found for return product/lot on the linked order.');
                }
                max = matching.reduce((sum, l) => sum.add(l.pickedQuantity), new client_1.Prisma.Decimal(0));
                const lotPart = line.lotId ?? 'any';
                bucketKey = `product:${line.productId}:lot:${lotPart}`;
            }
            const cur = buckets.get(bucketKey) ?? { max, add: new client_1.Prisma.Decimal(0) };
            cur.add = cur.add.add(line.expectedQuantity);
            buckets.set(bucketKey, cur);
        }
        for (const [key, { max, add }] of buckets) {
            const alreadyReturned = await this.sumActiveReturnQuantity(originalOutboundOrderId, key, excludeReturnOrderId, tx);
            const total = alreadyReturned.add(add);
            if (total.gt(max)) {
                throw new common_1.BadRequestException(`Return quantity exceeds shipped quantity for ${key.replace(/^line:|^product:/, '')} ` +
                    `(shipped ${max.toString()}, already returned ${alreadyReturned.toString()}, requested ${add.toString()}).`);
            }
        }
    }
    async sumActiveReturnQuantity(outboundOrderId, bucketKey, excludeReturnOrderId, tx) {
        const isLineBucket = bucketKey.startsWith('line:');
        const outboundOrderLineId = isLineBucket ? bucketKey.slice(5) : undefined;
        const productId = !isLineBucket
            ? bucketKey.split(':')[1]
            : undefined;
        const lotId = !isLineBucket && bucketKey.includes(':lot:')
            ? bucketKey.split(':lot:')[1]
            : undefined;
        const rows = await this.client(tx).returnOrderLine.findMany({
            where: {
                returnOrder: {
                    originalOutboundOrderId: outboundOrderId,
                    status: { in: returns_constants_1.RETURN_ACTIVE_FOR_QUOTA },
                    ...(excludeReturnOrderId ? { id: { not: excludeReturnOrderId } } : {}),
                },
                ...(outboundOrderLineId ? { outboundOrderLineId } : {}),
                ...(productId
                    ? {
                        productId,
                        ...(lotId && lotId !== 'any' ? { lotId } : {}),
                    }
                    : {}),
            },
            select: { expectedQuantity: true },
        });
        return rows.reduce((sum, r) => sum.add(r.expectedQuantity), new client_1.Prisma.Decimal(0));
    }
};
exports.ReturnQuantityValidation = ReturnQuantityValidation;
exports.ReturnQuantityValidation = ReturnQuantityValidation = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReturnQuantityValidation);
//# sourceMappingURL=return-quantity.validation.js.map