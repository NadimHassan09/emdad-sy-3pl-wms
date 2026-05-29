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
exports.ReturnWorkflowService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const return_disposition_policy_1 = require("./return-disposition.policy");
const return_inventory_service_1 = require("./return-inventory.service");
const returns_constants_1 = require("./returns.constants");
const ORDER_INCLUDE = {
    company: { select: { id: true, name: true } },
    warehouse: { select: { id: true, code: true, name: true } },
    originalOutbound: {
        select: { id: true, orderNumber: true, status: true },
    },
    lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
            product: { select: { id: true, sku: true, name: true, uom: true } },
            lot: { select: { id: true, lotNumber: true } },
            targetLocation: { select: { id: true, fullPath: true, type: true } },
        },
    },
};
let ReturnWorkflowService = class ReturnWorkflowService {
    prisma;
    companyAccess;
    inventory;
    audit;
    constructor(prisma, companyAccess, inventory, audit) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.inventory = inventory;
        this.audit = audit;
    }
    async inspectLine(user, returnOrderId, lineId, dto) {
        const order = await this.loadOrder(returnOrderId, user);
        if (!(0, returns_constants_1.isReturnInspectable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Return is not open for inspection (status: ${order.status}).`);
        }
        const line = order.lines.find((l) => l.id === lineId);
        if (!line)
            throw new common_1.NotFoundException('Return line not found.');
        if (line.receivedQuantity.lte(0)) {
            throw new common_1.BadRequestException('Inspect after at least some quantity has been received.');
        }
        if (line.lineStatus === client_1.ReturnLineStatus.posted) {
            throw new domain_exceptions_1.InvalidStateException('Posted lines cannot be re-inspected.');
        }
        const disposition = dto.disposition
            ? (0, return_disposition_policy_1.normalizeReturnDisposition)(dto.disposition)
            : line.disposition;
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            await tx.returnOrderLine.update({
                where: { id: lineId },
                data: {
                    condition: dto.condition ?? line.condition,
                    disposition,
                    inspectionNotes: dto.inspectionNotes?.trim() || line.inspectionNotes,
                    inspectedAt: now,
                    inspectedBy: user.id,
                    lineStatus: client_1.ReturnLineStatus.inspected,
                    ...(dto.targetLocationId !== undefined
                        ? { targetLocationId: dto.targetLocationId || null }
                        : {}),
                },
            });
            await this.syncOrderWorkflowStatus(tx, returnOrderId, {
                inspecting: true,
            });
            await this.audit.logTx(tx, {
                ...this.audit.fromPrincipal(user, {
                    companyId: order.companyId,
                    action: 'return.line.inspected',
                    resourceType: 'return_order_line',
                    resourceId: lineId,
                    newState: {
                        returnOrderId,
                        condition: dto.condition,
                        disposition,
                        targetLocationId: dto.targetLocationId,
                    },
                }),
            });
            return tx.returnOrder.findUniqueOrThrow({
                where: { id: returnOrderId },
                include: ORDER_INCLUDE,
            });
        });
    }
    async applyDisposition(user, returnOrderId, lineId, dto) {
        const order = await this.loadOrder(returnOrderId, user);
        if (!(0, returns_constants_1.isReturnInventoryApplicable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Return is not ready for inventory posting (status: ${order.status}).`);
        }
        if (!order.warehouseId) {
            throw new common_1.BadRequestException('Return order warehouseId is required before posting inventory.');
        }
        const line = order.lines.find((l) => l.id === lineId);
        if (!line)
            throw new common_1.NotFoundException('Return line not found.');
        if (line.lineStatus === client_1.ReturnLineStatus.posted) {
            throw new domain_exceptions_1.InvalidStateException('Line inventory already posted.');
        }
        if (line.receivedQuantity.lte(0)) {
            throw new common_1.BadRequestException('Cannot post inventory without received quantity.');
        }
        const disposition = (0, return_disposition_policy_1.normalizeReturnDisposition)(dto.disposition ?? line.disposition ?? client_1.ReturnItemDisposition.inspection_required);
        if ((0, return_disposition_policy_1.isPendingInspectionDisposition)(disposition)) {
            throw new common_1.BadRequestException('Resolve inspection (set a final disposition) before posting inventory.');
        }
        if (!(0, return_disposition_policy_1.isInventoryPostingDisposition)(disposition)) {
            throw new common_1.BadRequestException('Invalid disposition for inventory posting.');
        }
        const targetLocationId = dto.targetLocationId ?? line.targetLocationId;
        if (!targetLocationId) {
            throw new common_1.BadRequestException('targetLocationId is required for this disposition.');
        }
        return this.prisma.$transaction(async (tx) => {
            if (dto.disposition || dto.targetLocationId) {
                await tx.returnOrderLine.update({
                    where: { id: lineId },
                    data: {
                        disposition,
                        targetLocationId,
                        lineStatus: client_1.ReturnLineStatus.inspected,
                        inspectedAt: line.inspectedAt ?? new Date(),
                        inspectedBy: line.inspectedBy ?? user.id,
                    },
                });
            }
            const fresh = await tx.returnOrderLine.findUniqueOrThrow({ where: { id: lineId } });
            await this.inventory.applyLineInventory(tx, {
                returnOrderId,
                companyId: order.companyId,
                warehouseId: order.warehouseId,
                operatorId: user.id,
                line: {
                    id: fresh.id,
                    productId: fresh.productId,
                    lotId: fresh.lotId,
                    packageId: fresh.packageId,
                    receivedQuantity: fresh.receivedQuantity,
                    postedQuantity: fresh.postedQuantity,
                    disposition: fresh.disposition,
                    targetLocationId: fresh.targetLocationId,
                    lineStatus: fresh.lineStatus,
                },
            });
            await this.audit.logTx(tx, {
                ...this.audit.fromPrincipal(user, {
                    companyId: order.companyId,
                    action: 'return.line.inventory_posted',
                    resourceType: 'return_order_line',
                    resourceId: lineId,
                    newState: {
                        returnOrderId,
                        disposition,
                        targetLocationId,
                        quantity: fresh.receivedQuantity.toString(),
                    },
                }),
            });
            return tx.returnOrder.findUniqueOrThrow({
                where: { id: returnOrderId },
                include: ORDER_INCLUDE,
            });
        });
    }
    async postAllEligibleLines(user, returnOrderId) {
        const order = await this.loadOrder(returnOrderId, user);
        if (!order.warehouseId) {
            throw new common_1.BadRequestException('warehouseId is required on the return order.');
        }
        const eligible = order.lines.filter((l) => l.lineStatus !== client_1.ReturnLineStatus.posted &&
            l.receivedQuantity.gt(0) &&
            l.disposition &&
            (0, return_disposition_policy_1.isInventoryPostingDisposition)(l.disposition) &&
            l.targetLocationId);
        if (eligible.length === 0) {
            throw new common_1.BadRequestException('No lines are ready for inventory posting.');
        }
        for (const line of eligible) {
            await this.applyDisposition(user, returnOrderId, line.id, {
                targetLocationId: line.targetLocationId,
                disposition: line.disposition,
            });
        }
        return this.loadOrder(returnOrderId, user);
    }
    async loadOrder(returnOrderId, user) {
        const order = await this.prisma.returnOrder.findUnique({
            where: { id: returnOrderId },
            include: ORDER_INCLUDE,
        });
        if (!order)
            throw new common_1.NotFoundException('Return order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        return order;
    }
    async syncOrderWorkflowStatus(tx, returnOrderId, opts) {
        const order = await tx.returnOrder.findUnique({
            where: { id: returnOrderId },
            select: { status: true, receivingStartedAt: true, inspectingStartedAt: true },
        });
        if (!order)
            return;
        const now = new Date();
        const data = {};
        if (opts.receiving &&
            (order.status === client_1.ReturnOrderStatus.confirmed ||
                order.status === client_1.ReturnOrderStatus.receiving)) {
            data.status = client_1.ReturnOrderStatus.receiving;
            if (!order.receivingStartedAt)
                data.receivingStartedAt = now;
        }
        if (opts.inspecting &&
            (order.status === client_1.ReturnOrderStatus.receiving ||
                order.status === client_1.ReturnOrderStatus.inspecting)) {
            data.status = client_1.ReturnOrderStatus.inspecting;
            if (!order.inspectingStartedAt)
                data.inspectingStartedAt = now;
        }
        if (Object.keys(data).length > 0) {
            await tx.returnOrder.update({ where: { id: returnOrderId }, data });
        }
    }
    assertAllLinesPosted(lines) {
        const notPosted = lines.filter((l) => l.receivedQuantity.gt(0) && l.lineStatus !== client_1.ReturnLineStatus.posted);
        if (notPosted.length > 0) {
            throw new common_1.BadRequestException('All received lines must have inventory posted before completing the return.');
        }
    }
};
exports.ReturnWorkflowService = ReturnWorkflowService;
exports.ReturnWorkflowService = ReturnWorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        return_inventory_service_1.ReturnInventoryService,
        audit_log_service_1.AuditLogService])
], ReturnWorkflowService);
//# sourceMappingURL=return-workflow.service.js.map