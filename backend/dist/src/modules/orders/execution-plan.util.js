"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionMode = normalizeExecutionMode;
exports.parseInboundExecutionPlan = parseInboundExecutionPlan;
exports.assertInboundAdminPlanComplete = assertInboundAdminPlanComplete;
exports.parseOutboundExecutionPlan = parseOutboundExecutionPlan;
exports.assertOutboundAdminPlanComplete = assertOutboundAdminPlanComplete;
const common_1 = require("@nestjs/common");
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
function normalizeExecutionMode(raw) {
    return raw === 'admin' ? 'admin' : 'workers';
}
function parseInboundExecutionPlan(raw) {
    if (!isRecord(raw))
        return null;
    const warehouseId = typeof raw.warehouseId === 'string' ? raw.warehouseId : '';
    const receivingDockId = typeof raw.receivingDockId === 'string' ? raw.receivingDockId : '';
    const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = linesRaw
        .map((row) => {
        if (!isRecord(row))
            return null;
        const productId = typeof row.productId === 'string' ? row.productId : '';
        const expectedQty = Number(row.expectedQty ?? row.expectedQuantity ?? 0);
        if (!productId || !(expectedQty > 0))
            return null;
        const putawayRaw = Array.isArray(row.putaway) ? row.putaway : [];
        const putaway = putawayRaw
            .map((p) => {
            if (!isRecord(p))
                return null;
            const locationId = typeof p.locationId === 'string' ? p.locationId : '';
            const qty = Number(p.qty ?? p.quantity ?? 0);
            if (!locationId || !(qty > 0))
                return null;
            return { locationId, qty };
        })
            .filter((x) => !!x);
        return {
            productId,
            orderLineId: typeof row.orderLineId === 'string' ? row.orderLineId : undefined,
            expectedQty,
            putaway,
        };
    })
        .filter((x) => !!x);
    return {
        warehouseId,
        receivingDockId,
        lines,
        planUpdatedAt: typeof raw.planUpdatedAt === 'string' ? raw.planUpdatedAt : new Date().toISOString(),
    };
}
function assertInboundAdminPlanComplete(plan) {
    if (!plan.warehouseId?.trim()) {
        throw new common_1.BadRequestException('Admin plan requires warehouseId.');
    }
    if (!plan.receivingDockId?.trim()) {
        throw new common_1.BadRequestException('Admin plan requires receivingDockId.');
    }
    if (plan.lines.length === 0) {
        throw new common_1.BadRequestException('Admin plan requires at least one line.');
    }
    for (const line of plan.lines) {
        const splits = line.putaway ?? [];
        if (splits.length === 0) {
            throw new common_1.BadRequestException(`Admin plan requires putaway locations for product ${line.productId}.`);
        }
        const sum = splits.reduce((a, s) => a + s.qty, 0);
        if (Math.abs(sum - line.expectedQty) > 1e-6) {
            throw new common_1.BadRequestException(`Putaway quantities for product ${line.productId} must sum to ${line.expectedQty} (got ${sum}).`);
        }
    }
}
function parseOutboundExecutionPlan(raw) {
    if (!isRecord(raw))
        return null;
    const warehouseId = typeof raw.warehouseId === 'string' ? raw.warehouseId : '';
    const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = linesRaw
        .map((row) => {
        if (!isRecord(row))
            return null;
        const productId = typeof row.productId === 'string' ? row.productId : '';
        const expectedQty = Number(row.expectedQty ?? row.requestedQuantity ?? 0);
        if (!productId || !(expectedQty > 0))
            return null;
        return {
            productId,
            orderLineId: typeof row.orderLineId === 'string' ? row.orderLineId : undefined,
            expectedQty,
        };
    })
        .filter((x) => !!x);
    const suggestedPicks = Array.isArray(raw.suggestedPicks)
        ? raw.suggestedPicks
            .map((p) => {
            if (!isRecord(p))
                return null;
            const productId = typeof p.productId === 'string' ? p.productId : '';
            const locationId = typeof p.locationId === 'string' ? p.locationId : '';
            const qty = Number(p.qty ?? p.quantity ?? 0);
            if (!productId || !locationId || !(qty > 0))
                return null;
            return {
                productId,
                locationId,
                qty,
                outboundOrderLineId: typeof p.outboundOrderLineId === 'string' ? p.outboundOrderLineId : undefined,
                locationPath: typeof p.locationPath === 'string' ? p.locationPath : undefined,
                lotId: p.lotId === null || p.lotId === undefined
                    ? null
                    : typeof p.lotId === 'string'
                        ? p.lotId
                        : null,
            };
        })
            .filter((x) => !!x)
        : undefined;
    return {
        warehouseId,
        packingLocationId: typeof raw.packingLocationId === 'string' ? raw.packingLocationId : undefined,
        dispatchDockId: typeof raw.dispatchDockId === 'string' ? raw.dispatchDockId : undefined,
        requiresPacking: raw.requiresPacking !== false,
        lines,
        suggestedPicks,
        planUpdatedAt: typeof raw.planUpdatedAt === 'string' ? raw.planUpdatedAt : new Date().toISOString(),
    };
}
function assertOutboundAdminPlanComplete(plan) {
    if (!plan.warehouseId?.trim()) {
        throw new common_1.BadRequestException('Admin plan requires warehouseId.');
    }
    if (plan.lines.length === 0) {
        throw new common_1.BadRequestException('Admin plan requires at least one line.');
    }
}
//# sourceMappingURL=execution-plan.util.js.map