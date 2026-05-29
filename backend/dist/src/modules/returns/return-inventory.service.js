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
exports.ReturnInventoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const location_operational_1 = require("../../common/utils/location-operational");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const ledger_idempotency_service_1 = require("../inventory/ledger-idempotency.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const return_disposition_policy_1 = require("./return-disposition.policy");
let ReturnInventoryService = class ReturnInventoryService {
    prisma;
    stock;
    ledger;
    constructor(prisma, stock, ledger) {
        this.prisma = prisma;
        this.stock = stock;
        this.ledger = ledger;
    }
    async applyLineInventory(tx, ctx) {
        const line = ctx.line;
        if (line.lineStatus === client_1.ReturnLineStatus.posted) {
            throw new common_1.BadRequestException('Return line inventory has already been posted.');
        }
        if (!(0, return_disposition_policy_1.isInventoryPostingDisposition)(line.disposition)) {
            throw new common_1.BadRequestException('Disposition does not allow inventory posting (complete inspection first).');
        }
        if (!line.targetLocationId) {
            throw new common_1.BadRequestException('targetLocationId is required to post return inventory.');
        }
        const qtyToPost = line.receivedQuantity.minus(line.postedQuantity);
        if (qtyToPost.lte(0)) {
            throw new common_1.BadRequestException('No received quantity remains to post.');
        }
        const location = await tx.location.findUnique({
            where: { id: line.targetLocationId },
            select: { id: true, warehouseId: true, type: true, status: true },
        });
        if (!location || location.warehouseId !== ctx.warehouseId) {
            throw new common_1.BadRequestException('Target location not found in the return warehouse.');
        }
        (0, location_operational_1.assertLocationUsableForInventoryMove)(location.status);
        const disposition = (0, return_disposition_policy_1.normalizeReturnDisposition)(line.disposition);
        (0, return_disposition_policy_1.assertLocationAllowedForDisposition)(disposition, location.type);
        const movementType = this.movementTypeForDisposition(disposition);
        const stockStatus = (0, return_disposition_policy_1.stockStatusForDisposition)(disposition);
        const meta = await this.stock.upsertPositiveWithMeta(tx, {
            companyId: ctx.companyId,
            productId: line.productId,
            locationId: location.id,
            warehouseId: ctx.warehouseId,
            lotId: line.lotId,
            quantity: qtyToPost.toString(),
        });
        await this.setStockStatus(tx, {
            companyId: ctx.companyId,
            productId: line.productId,
            locationId: location.id,
            lotId: line.lotId,
            status: stockStatus,
        });
        const idempotencyKey = `return:${ctx.returnOrderId}:line:${line.id}:post`;
        await this.ledger.appendIfAbsent(tx, idempotencyKey, {
            companyId: ctx.companyId,
            productId: line.productId,
            lotId: line.lotId,
            toLocationId: location.id,
            movementType,
            quantity: qtyToPost,
            quantityBefore: meta.before,
            quantityAfter: meta.after,
            referenceType: client_1.LedgerRefType.return_order,
            referenceId: ctx.returnOrderId,
            operatorId: ctx.operatorId,
        });
        if (line.packageId) {
            await tx.package.updateMany({
                where: { id: line.packageId },
                data: { status: 'returned', updatedAt: new Date() },
            });
        }
        await tx.returnOrderLine.update({
            where: { id: line.id },
            data: {
                postedQuantity: line.receivedQuantity,
                postedAt: new Date(),
                lineStatus: client_1.ReturnLineStatus.posted,
            },
        });
    }
    movementTypeForDisposition(disposition) {
        const d = (0, return_disposition_policy_1.normalizeReturnDisposition)(disposition);
        if (d === client_1.ReturnItemDisposition.discard) {
            return client_1.MovementType.scrap;
        }
        if (d === client_1.ReturnItemDisposition.quarantine || d === client_1.ReturnItemDisposition.damaged) {
            return client_1.MovementType.qc_quarantine;
        }
        return client_1.MovementType.return_receive;
    }
    async setStockStatus(tx, m) {
        const lotId = m.lotId;
        if (lotId) {
            await tx.$executeRaw `
        UPDATE current_stock
           SET status = ${m.status}::stock_status,
               last_movement_at = NOW()
         WHERE company_id = ${m.companyId}::uuid
           AND product_id = ${m.productId}::uuid
           AND location_id = ${m.locationId}::uuid
           AND lot_id = ${lotId}::uuid
           AND package_id IS NULL
      `;
        }
        else {
            await tx.$executeRaw `
        UPDATE current_stock
           SET status = ${m.status}::stock_status,
               last_movement_at = NOW()
         WHERE company_id = ${m.companyId}::uuid
           AND product_id = ${m.productId}::uuid
           AND location_id = ${m.locationId}::uuid
           AND lot_id IS NULL
           AND package_id IS NULL
      `;
        }
    }
};
exports.ReturnInventoryService = ReturnInventoryService;
exports.ReturnInventoryService = ReturnInventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers,
        ledger_idempotency_service_1.LedgerIdempotencyService])
], ReturnInventoryService);
//# sourceMappingURL=return-inventory.service.js.map