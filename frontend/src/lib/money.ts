/**
 * The three currencies EMDAD distinguishes (mirrors backend common/money/currency.ts):
 * USD, SYP = the OLD Syrian pound (the code stored on existing data), SYP_NEW = the NEW Syrian pound.
 * 1 new pound = 100 old pounds. A carrier receives the currency it uses; here we only show the same
 * value in all three.
 */
export type Currency = 'USD' | 'SYP' | 'SYP_NEW';

export const OLD_SYP_PER_NEW_SYP = 100;

export function normalizeCurrency(value: string | null | undefined): Currency {
  const v = value?.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'SYP_NEW' || v === 'NEW_SYP') return 'SYP_NEW';
  if (v === 'SYP' || v === 'SYP_OLD' || v === 'OLD_SYP') return 'SYP';
  return 'USD';
}

export function isSyrianPound(value: string | null | undefined): boolean {
  return normalizeCurrency(value) !== 'USD';
}

/** Either pound is "SYP" when a carrier or filter only knows the family. */
export function currencyFamily(value: string | null | undefined): 'USD' | 'SYP' {
  return isSyrianPound(value) ? 'SYP' : 'USD';
}

export const CURRENCY_LABEL: Record<Currency, { en: string; ar: string; short: { en: string; ar: string } }> = {
  USD: { en: 'US dollar', ar: 'دولار أمريكي', short: { en: 'USD', ar: '$' } },
  SYP: { en: 'old Syrian pound', ar: 'ليرة سورية قديمة', short: { en: 'old SYP', ar: 'ل.س قديمة' } },
  SYP_NEW: { en: 'new Syrian pound', ar: 'ليرة سورية جديدة', short: { en: 'new SYP', ar: 'ل.س جديدة' } },
};

function unitsPerUsd(currency: Currency, usdToOldSypRate: number): number {
  if (currency === 'SYP') return usdToOldSypRate;
  if (currency === 'SYP_NEW') return usdToOldSypRate / OLD_SYP_PER_NEW_SYP;
  return 1;
}

/** Converts between the three currencies; null when a pound rate is needed and missing. */
export function convertMoney(
  amount: number,
  from: string | null | undefined,
  to: string | null | undefined,
  usdToOldSypRate: number | null | undefined,
): number | null {
  const a = normalizeCurrency(from);
  const b = normalizeCurrency(to);
  if (!Number.isFinite(amount)) return null;
  if (a === b) return amount;
  // The two pounds are tied by the fixed 100 to 1 redenomination: no rate, no rounding noise.
  if (a === 'SYP_NEW' && b === 'SYP') return amount * OLD_SYP_PER_NEW_SYP;
  if (a === 'SYP' && b === 'SYP_NEW') return amount / OLD_SYP_PER_NEW_SYP;
  if (!usdToOldSypRate || !Number.isFinite(usdToOldSypRate) || usdToOldSypRate <= 0) return null;
  const out = (amount / unitsPerUsd(a, usdToOldSypRate)) * unitsPerUsd(b, usdToOldSypRate);
  return Number(out.toFixed(6));
}

export function allCurrencyValues(
  amount: number,
  currency: string | null | undefined,
  usdToOldSypRate: number | null | undefined,
): Record<Currency, number | null> {
  return {
    USD: convertMoney(amount, currency, 'USD', usdToOldSypRate),
    SYP_NEW: convertMoney(amount, currency, 'SYP_NEW', usdToOldSypRate),
    SYP: convertMoney(amount, currency, 'SYP', usdToOldSypRate),
  };
}

/** "$2.50", "300 ل.س جديدة" or "30,000 ل.س قديمة" (English: "300 new SYP"). */
export function formatMoney(amount: number, currency: string | null | undefined, isArabic = false): string {
  const c = normalizeCurrency(currency);
  if (c === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);
  }
  const n = new Intl.NumberFormat(isArabic ? 'ar-SY' : 'en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
  const label = CURRENCY_LABEL[c].short[isArabic ? 'ar' : 'en'];
  return `${n} ${label}`;
}

/** Same value in the other two currencies, for a secondary line: "≈ $2.31 · 30,000 old SYP". */
export function formatEquivalents(
  amount: number,
  currency: string | null | undefined,
  usdToOldSypRate: number | null | undefined,
  isArabic = false,
): string | null {
  const own = normalizeCurrency(currency);
  const values = allCurrencyValues(amount, currency, usdToOldSypRate);
  const parts = (['USD', 'SYP_NEW', 'SYP'] as Currency[])
    .filter((c) => c !== own && values[c] != null)
    .map((c) => formatMoney(values[c] as number, c, isArabic));
  return parts.length > 0 ? `≈ ${parts.join(' · ')}` : null;
}
