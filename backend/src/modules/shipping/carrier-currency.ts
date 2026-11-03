/**
 * Syrian-pound unit used by each carrier. The carrier is the source of truth: a unit is
 * recorded here only with evidence taken from that carrier, never assumed. EMDAD keeps its
 * own money in USD and converts each carrier's SYP amounts using that carrier's unit.
 * A carrier that is not listed keeps the platform unit (current behaviour) until confirmed.
 */
export type SypUnit = 'new' | 'old';

/** The redenomination: 1 new Syrian pound equals 100 old ones. */
export const OLD_SYP_PER_NEW_SYP = 100;

const CARRIER_SYP_UNITS: Record<string, { unit: SypUnit; evidence: string }> = {
  BABEL_EXPRESS: {
    unit: 'new',
    evidence:
      'Babel portal ledger (3 Oct 2026): "تحويل رصيد ليرة سورية جديدة الى دولار امريكي بسعر تصريف 136.00"; shipping fees 70-700 SYP; final balance "ليرة سورية جديدة".',
  },
  SENA_EXPRESS: {
    unit: 'new',
    evidence:
      'Owner decision (3 Nov 2026): treat Sena SYP as the new pound. Sena portal states only "SYP" and has not confirmed the unit; revisit when Sena answers.',
  },
};

export function carrierSypUnit(providerCode?: string | null): SypUnit | null {
  const key = providerCode?.trim().toUpperCase();
  return key ? CARRIER_SYP_UNITS[key]?.unit ?? null : null;
}

/**
 * Unit of a "1 USD = R SYP" rate, read from its size (about 13,000 old or 130 new).
 * Returns null in the ambiguous middle so nothing is rescaled on a doubtful rate.
 */
export function sypUnitOfRate(usdToSypRate: number): SypUnit | null {
  if (!Number.isFinite(usdToSypRate) || usdToSypRate <= 0) return null;
  if (usdToSypRate >= 2000) return 'old';
  if (usdToSypRate <= 500) return 'new';
  return null;
}

/** The platform USD/SYP rate expressed in the carrier's own pound unit. */
export function rateForCarrierUnit(platformRate: number, carrierUnit: SypUnit | null | undefined): number {
  const platformUnit = sypUnitOfRate(platformRate);
  if (!carrierUnit || !platformUnit || carrierUnit === platformUnit) return platformRate;
  return carrierUnit === 'new' ? platformRate / OLD_SYP_PER_NEW_SYP : platformRate * OLD_SYP_PER_NEW_SYP;
}
