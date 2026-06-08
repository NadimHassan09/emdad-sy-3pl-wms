import { Prisma } from '@prisma/client';

export type BillingRateSnapshot = {
  billingPlanId: string;
  fixedSubscriptionFee: string;
  inboundOrderFee: string;
  outboundOrderFee: string;
  packagingFee: string;
  qualityCheckFee: string;
  excessVolumeFeePerDay: string;
  excessWeightFeePerDay: string;
  reservedVolume: string;
  reservedWeight: string;
  snapshottedAt: string;
};

type PlanRateSource = {
  id: string;
  fixedSubscriptionFee: Prisma.Decimal;
  inboundOrderFee: Prisma.Decimal;
  outboundOrderFee: Prisma.Decimal;
  packagingFee: Prisma.Decimal;
  qualityCheckFee: Prisma.Decimal;
  excessVolumeFeePerDay: Prisma.Decimal;
  excessWeightFeePerDay: Prisma.Decimal;
  reservedVolume: Prisma.Decimal;
  reservedWeight: Prisma.Decimal;
};

export function buildRateSnapshotFromPlan(plan: PlanRateSource): BillingRateSnapshot {
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

export function parseRateSnapshot(raw: unknown): BillingRateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
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
  ] as const;
  for (const key of required) {
    if (typeof o[key] !== 'string') return null;
  }
  return {
    billingPlanId: o.billingPlanId as string,
    fixedSubscriptionFee: o.fixedSubscriptionFee as string,
    inboundOrderFee: o.inboundOrderFee as string,
    outboundOrderFee: o.outboundOrderFee as string,
    packagingFee: o.packagingFee as string,
    qualityCheckFee: o.qualityCheckFee as string,
    excessVolumeFeePerDay: o.excessVolumeFeePerDay as string,
    excessWeightFeePerDay: o.excessWeightFeePerDay as string,
    reservedVolume: o.reservedVolume as string,
    reservedWeight: o.reservedWeight as string,
    snapshottedAt: typeof o.snapshottedAt === 'string' ? o.snapshottedAt : new Date(0).toISOString(),
  };
}

export function rateSnapshotToDecimals(snapshot: BillingRateSnapshot) {
  return {
    fixedSubscriptionFee: new Prisma.Decimal(snapshot.fixedSubscriptionFee),
    inboundOrderFee: new Prisma.Decimal(snapshot.inboundOrderFee),
    outboundOrderFee: new Prisma.Decimal(snapshot.outboundOrderFee),
    packagingFee: new Prisma.Decimal(snapshot.packagingFee),
    qualityCheckFee: new Prisma.Decimal(snapshot.qualityCheckFee),
    excessVolumeFeePerDay: new Prisma.Decimal(snapshot.excessVolumeFeePerDay),
    excessWeightFeePerDay: new Prisma.Decimal(snapshot.excessWeightFeePerDay),
    reservedVolume: new Prisma.Decimal(snapshot.reservedVolume),
    reservedWeight: new Prisma.Decimal(snapshot.reservedWeight),
  };
}
