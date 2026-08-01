"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRateSnapshotFromPlan = buildRateSnapshotFromPlan;
exports.parseRateSnapshot = parseRateSnapshot;
exports.rateSnapshotToDecimals = rateSnapshotToDecimals;
const client_1 = require("@prisma/client");
function buildRateSnapshotFromPlan(plan) {
    const baseFee = plan.outboundBaseFee.gt(0)
        ? plan.outboundBaseFee
        : plan.outboundOrderFee;
    return {
        billingPlanId: plan.id,
        fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
        inboundOrderFee: plan.inboundOrderFee.toString(),
        outboundOrderFee: baseFee.toString(),
        outboundBaseFee: baseFee.toString(),
        outboundIncludedItems: plan.outboundIncludedItems,
        outboundAdditionalItemFee: plan.outboundAdditionalItemFee.toString(),
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
    const outboundBaseFee = typeof o.outboundBaseFee === 'string' ? o.outboundBaseFee : o.outboundOrderFee;
    const outboundIncludedItems = typeof o.outboundIncludedItems === 'number' ? o.outboundIncludedItems : 0;
    const outboundAdditionalItemFee = typeof o.outboundAdditionalItemFee === 'string' ? o.outboundAdditionalItemFee : '0';
    return {
        billingPlanId: o.billingPlanId,
        fixedSubscriptionFee: o.fixedSubscriptionFee,
        inboundOrderFee: o.inboundOrderFee,
        outboundOrderFee: o.outboundOrderFee,
        outboundBaseFee,
        outboundIncludedItems,
        outboundAdditionalItemFee,
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
    const outboundBaseFee = new client_1.Prisma.Decimal(snapshot.outboundBaseFee || snapshot.outboundOrderFee);
    return {
        fixedSubscriptionFee: new client_1.Prisma.Decimal(snapshot.fixedSubscriptionFee),
        inboundOrderFee: new client_1.Prisma.Decimal(snapshot.inboundOrderFee),
        outboundOrderFee: outboundBaseFee,
        outboundBaseFee,
        outboundIncludedItems: snapshot.outboundIncludedItems ?? 0,
        outboundAdditionalItemFee: new client_1.Prisma.Decimal(snapshot.outboundAdditionalItemFee ?? '0'),
        packagingFee: new client_1.Prisma.Decimal(snapshot.packagingFee),
        qualityCheckFee: new client_1.Prisma.Decimal(snapshot.qualityCheckFee),
        excessVolumeFeePerDay: new client_1.Prisma.Decimal(snapshot.excessVolumeFeePerDay),
        excessWeightFeePerDay: new client_1.Prisma.Decimal(snapshot.excessWeightFeePerDay),
        reservedVolume: new client_1.Prisma.Decimal(snapshot.reservedVolume),
        reservedWeight: new client_1.Prisma.Decimal(snapshot.reservedWeight),
    };
}
//# sourceMappingURL=billing-rate-snapshot.util.js.map