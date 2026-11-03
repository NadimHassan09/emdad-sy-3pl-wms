/**
 * Published hard limits of couriers reachable through an aggregator (Sila SY courier
 * catalogue, https://sila-sy.com/couriers, recorded 3 Nov 2026). A quote that breaks one
 * of these is marked unavailable up front, so nobody can select an option that fails on send.
 * Only documented limits belong here; unknown limits are never guessed.
 */
export type CarrierConstraint = {
  /** Courier name pattern, matched against the service name. */
  match: RegExp;
  label: string;
  maxWeightKg?: number;
  /** Currencies the courier can collect COD in. Omitted means no documented limit. */
  codCurrencies?: Array<'USD' | 'SYP'>;
};

export const CARRIER_CONSTRAINTS: CarrierConstraint[] = [
  { match: /karam|كرم/i, label: 'Karam', maxWeightKg: 10 },
  { match: /mersal|مرسال/i, label: 'Mersal', codCurrencies: ['USD'] },
];

export type ConstraintInput = {
  serviceName?: string | null;
  carrierName?: string | null;
  weightKg?: number | null;
  /** Largest single carton, when known. */
  maxPartWeightKg?: number | null;
  codAmount?: number | null;
  /** Currency COD is collected in; only checked when the user chose it explicitly. */
  codCurrency?: string | null;
  collectionMode?: 'all' | 'explicit' | null;
};

/** Returns a user-facing reason when the shipment breaks a documented limit, else null. */
export function carrierConstraintViolation(input: ConstraintInput): string | null {
  const name = `${input.serviceName ?? ''} ${input.carrierName ?? ''}`;
  const rule = CARRIER_CONSTRAINTS.find((c) => c.match.test(name));
  if (!rule) return null;

  const heaviest = Math.max(Number(input.weightKg) || 0, Number(input.maxPartWeightKg) || 0);
  if (rule.maxWeightKg != null && heaviest > rule.maxWeightKg) {
    return `${rule.label} accepts at most ${rule.maxWeightKg} kg per shipment`;
  }

  const cod = Number(input.codAmount) || 0;
  const cur = input.codCurrency?.trim().toUpperCase();
  if (
    rule.codCurrencies &&
    cod > 0 &&
    input.collectionMode === 'explicit' &&
    (cur === 'USD' || cur === 'SYP') &&
    !rule.codCurrencies.includes(cur)
  ) {
    return `${rule.label} collects COD in ${rule.codCurrencies.join('/')} only`;
  }
  return null;
}
