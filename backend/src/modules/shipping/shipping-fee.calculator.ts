/**
 * Client shipping rate math.
 *
 * Rounding policy `ceil_partial`:
 * - Billable weight is the shipment weight in kilograms (4 decimal places).
 * - Weight at or below the included base weight uses the group base rate only.
 * - Weight above the base is split into increments of `incrementKg`.
 * - Each started increment is charged in full, including a partial last increment.
 * - A weight exactly on an increment boundary adds that increment once, not twice.
 * - Comparison uses integer units of 0.0001 kg so binary float error cannot add an extra step.
 *
 * This does not calculate volumetric or chargeable weight. Callers pass the
 * billable kilograms the rest of OMS already stores.
 */

export const SHIPPING_FEE_ROUNDING_POLICY = 'ceil_partial' as const;

const WEIGHT_SCALE = 10_000;

export type ShippingFeeWeightRule = {
  baseWeightKg: number;
  incrementKg: number;
  incrementCharge: number;
};

export type ShippingFeeQuoteInput = ShippingFeeWeightRule & {
  baseRate: number;
  weightKg: number;
};

export type ShippingFeeQuote = {
  amount: number;
  weightKg: number;
  baseRate: number;
  includedWeightKg: number;
  incrementKg: number;
  incrementCharge: number;
  increments: number;
  roundingPolicy: typeof SHIPPING_FEE_ROUNDING_POLICY;
};

export class ShippingFeeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingFeeValidationError';
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ShippingFeeValidationError(`${label} must be a number greater than or equal to zero.`);
  }
}

export function assertWeightRule(rule: ShippingFeeWeightRule): void {
  if (!Number.isFinite(rule.baseWeightKg) || rule.baseWeightKg <= 0) {
    throw new ShippingFeeValidationError('Base weight included in the rate must be greater than zero.');
  }
  if (!Number.isFinite(rule.incrementKg) || rule.incrementKg <= 0) {
    throw new ShippingFeeValidationError('Additional weight increment must be greater than zero.');
  }
  assertFiniteNonNegative(rule.incrementCharge, 'Additional charge');
}

export function toWeightUnits(kg: number): number {
  return Math.round(kg * WEIGHT_SCALE);
}

/** Increments charged above the included weight. Exact boundaries do not round up an extra step. */
export function countWeightIncrements(weightKg: number, rule: ShippingFeeWeightRule): number {
  assertWeightRule(rule);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new ShippingFeeValidationError('Billable weight must be greater than zero.');
  }
  const excess = toWeightUnits(weightKg) - toWeightUnits(rule.baseWeightKg);
  if (excess <= 0) return 0;
  const step = toWeightUnits(rule.incrementKg);
  return Math.floor((excess + step - 1) / step);
}

export function roundMoney(amount: number): number {
  return Math.round(amount * WEIGHT_SCALE) / WEIGHT_SCALE;
}

export function quoteClientShippingRate(input: ShippingFeeQuoteInput): ShippingFeeQuote {
  assertFiniteNonNegative(input.baseRate, 'Base rate');
  const increments = countWeightIncrements(input.weightKg, input);
  return {
    amount: roundMoney(input.baseRate + increments * input.incrementCharge),
    weightKg: input.weightKg,
    baseRate: input.baseRate,
    includedWeightKg: input.baseWeightKg,
    incrementKg: input.incrementKg,
    incrementCharge: input.incrementCharge,
    increments,
    roundingPolicy: SHIPPING_FEE_ROUNDING_POLICY,
  };
}

/** Optional international per-kilogram client rate. Not used for local group pricing. */
export function quoteExternalPerKg(weightKg: number, perKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new ShippingFeeValidationError('Billable weight must be greater than zero.');
  }
  assertFiniteNonNegative(perKg, 'External price per kilogram');
  return roundMoney(weightKg * perKg);
}
