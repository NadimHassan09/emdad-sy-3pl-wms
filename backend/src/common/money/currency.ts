import { Prisma } from '@prisma/client';

/**
 * The three currencies EMDAD distinguishes:
 * - USD: the internal currency;
 * - SYP: the OLD Syrian pound (the code stored on all existing data);
 * - SYP_NEW: the NEW Syrian pound (1 new = 100 old).
 * A carrier gets the currency it uses itself; EMDAD only converts to show the same value in all three.
 */
export type Currency = 'USD' | 'SYP' | 'SYP_NEW';

export const OLD_SYP_PER_NEW_SYP = 100;

/** Accepts SYP_OLD as another spelling of the stored legacy code; anything unknown is USD. */
export function normalizeCurrency(value: string | null | undefined): Currency {
  const v = value?.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'SYP_NEW' || v === 'NEW_SYP') return 'SYP_NEW';
  if (v === 'SYP' || v === 'SYP_OLD' || v === 'OLD_SYP') return 'SYP';
  return 'USD';
}

export function isSyrianPound(value: string | null | undefined): boolean {
  return normalizeCurrency(value) !== 'USD';
}

/** Pounds of either unit are the same family when a carrier says it collects "SYP". */
export function currencyFamily(value: string | null | undefined): 'USD' | 'SYP' {
  return isSyrianPound(value) ? 'SYP' : 'USD';
}

/** The code sent to a carrier: it only knows USD or SYP and applies its own pound unit. */
export function wireCurrency(value: string | null | undefined): 'USD' | 'SYP' {
  return currencyFamily(value);
}

/** Pounds of a unit that one USD buys, given the platform rate (1 USD = R old SYP). */
function unitsPerUsd(currency: Currency, usdToOldSypRate: number): number {
  if (currency === 'SYP') return usdToOldSypRate;
  if (currency === 'SYP_NEW') return usdToOldSypRate / OLD_SYP_PER_NEW_SYP;
  return 1;
}

/** Converts between any two of the three currencies. Returns null when a pound rate is needed and missing. */
export function convertMoney(
  amount: Prisma.Decimal.Value,
  from: string | null | undefined,
  to: string | null | undefined,
  usdToOldSypRate: number | null,
): Prisma.Decimal | null {
  const a = normalizeCurrency(from);
  const b = normalizeCurrency(to);
  const value = new Prisma.Decimal(amount);
  if (a === b) return value;
  if (!usdToOldSypRate || !Number.isFinite(usdToOldSypRate) || usdToOldSypRate <= 0) return null;
  const usd = value.div(unitsPerUsd(a, usdToOldSypRate));
  return usd.times(unitsPerUsd(b, usdToOldSypRate));
}

/** The same value in all three currencies (null entries when no rate is available). */
export function allCurrencyValues(
  amount: Prisma.Decimal.Value,
  currency: string | null | undefined,
  usdToOldSypRate: number | null,
): Record<Currency, Prisma.Decimal | null> {
  return {
    USD: convertMoney(amount, currency, 'USD', usdToOldSypRate)?.toDecimalPlaces(2) ?? null,
    SYP_NEW: convertMoney(amount, currency, 'SYP_NEW', usdToOldSypRate)?.toDecimalPlaces(0) ?? null,
    SYP: convertMoney(amount, currency, 'SYP', usdToOldSypRate)?.toDecimalPlaces(0) ?? null,
  };
}

export const CURRENCY_LABEL: Record<Currency, { en: string; ar: string }> = {
  USD: { en: 'US dollar', ar: 'دولار أمريكي' },
  SYP: { en: 'old Syrian pound', ar: 'ليرة سورية قديمة' },
  SYP_NEW: { en: 'new Syrian pound', ar: 'ليرة سورية جديدة' },
};

/**
 * Currency code for a carrier that also works in other currencies (for example Sena in AED):
 * pounds of either unit go as plain SYP, any other code is passed through untouched.
 */
export function wireCurrencyCode(value: string | null | undefined, fallback = 'SYP'): string {
  const v = value?.trim();
  if (!v) return fallback;
  return isSyrianPound(v) ? 'SYP' : v;
}
