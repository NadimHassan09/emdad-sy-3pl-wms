"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRateSnapshotFromPlan = buildRateSnapshotFromPlan;
exports.parseRateSnapshot = parseRateSnapshot;
exports.rateSnapshotToDecimals = rateSnapshotToDecimals;
const client_1 = require("@prisma/client");
function buildRateSnapshotFromPlan(plan) {
    return {
        billingPlanId: plan.id,
        fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
        inboundOrderFee: plan.inboundOrderFee.toString(),
        outboundOrderFee: plan.outboundOrderFee.toString(),
        packagingFee: plan.packagingFee.toString(),
        qualityCheckFee: plan.qualityCheckFee.toString(),
        excessVolumeFeePerDay: plan.excessVolumeFeePerDay.toString(),
        excessWeightFeePerDay: plan.excessWeightFeePerDay.toString(),
        reservedVolume: plan.reservedVolume.toString(),
        reservedWeight: plan.reservedWeight.toString(),
        snapshottedAt: new Date().toISOString(),
    };
}
function parseRateSnapshot(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const required = [
        'billingPlanId',
        'fixedSubscriptionFee',
        'inboundOrderFee',
        'outboundOrderFee',
        'packagingFee',
        'qualityCheckFee',
        'excessVolumeFeePerDay',
        'excessWeightFeePerDay',
        'reservedVolume',
        'reservedWeight',
    ];
    for (const key of required) {
        if (typeof o[key] !== 'string')
            return null;
    }
    return {
        billingPlanId: o.billingPlanId,
        fixedSubscriptionFee: o.fixedSubscriptionFee,
        inboundOrderFee: o.inboundOrderFee,
        outboundOrderFee: o.outboundOrderFee,
        packagingFee: o.packagingFee,
        qualityCheckFee: o.qualityCheckFee,
        excessVolumeFeePerDay: o.excessVolumeFeePerDay,
        excessWeightFeePerDay: o.excessWeightFeePerDay,
        reservedVolume: o.reservedVolume,
        reservedWeight: o.reservedWeight,
        snapshottedAt: typeof o.snapshottedAt === 'string' ? o.snapshottedAt : new Date(0).toISOString(),
    };
}
function rateSnapshotToDecimals(snapshot) {
    return {
        fixedSubscriptionFee: new client_1.Prisma.Decimal(snapshot.fixedSubscriptionFee),
        inboundOrderFee: new client_1.Prisma.Decimal(snapshot.inboundOrderFee),
        outboundOrderFee: new client_1.Prisma.Decimal(snapshot.outboundOrderFee),
        packagingFee: new client_1.Prisma.Decimal(snapshot.packagingFee),
        qualityCheckFee: new client_1.Prisma.Decimal(snapshot.qualityCheckFee),
        excessVolumeFeePerDay: new client_1.Prisma.Decimal(snapshot.excessVolumeFeePerDay),
        excessWeightFeePerDay: new client_1.Prisma.Decimal(snapshot.excessWeightFeePerDay),
        reservedVolume: new client_1.Prisma.Decimal(snapshot.reservedVolume),
        reservedWeight: new client_1.Prisma.Decimal(snapshot.reservedWeight),
    };
}
//# sourceMappingURL=billing-rate-snapshot.util.js.map