import { convertMoney, normalizeCurrency } from '../../common/money/currency';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

/** The finance account is USD only. Every amount is converted to USD before it touches a balance. */
export const ACCOUNT_CURRENCY = 'USD';

export type AccountAmount = {
  amount: Prisma.Decimal;
  /** Set when a conversion happened: SYP per 1 USD in the platform unit, and where the rate came from. */
  fxRate: number | null;
  fxSource: string | null;
};

/** The admin-managed 1 USD = R SYP rate, or null when none is usable. */
export async function readManagedUsdToSypRate(
  prisma: Pick<PrismaService, 'shippingFxSettings'>,
): Promise<{ rate: number; source: string } | null> {
  const row = await prisma.shippingFxSettings.findFirst();
  if (!row) return null;
  const rate = row.mode === 'automatic' ? row.lastAutoRate : row.manualRate;
  const n = rate == null ? NaN : Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { rate: n, source: row.mode === 'automatic' ? row.autoSource ?? 'automatic' : 'manual' };
}

/**
 * Converts an amount to account currency. USD is returned as is. SYP needs the managed rate;
 * without one the conversion is refused (null) instead of guessing, so a balance is never wrong.
 */
export function toAccountAmount(
  amount: Prisma.Decimal.Value,
  currency: string | null | undefined,
  rate: { rate: number; source: string } | null,
): AccountAmount | null {
  const value = new Prisma.Decimal(amount);
  if (normalizeCurrency(currency ?? ACCOUNT_CURRENCY) === 'USD') {
    return { amount: value, fxRate: null, fxSource: null };
  }
  if (!rate) return null;
  // Old (SYP) and new (SYP_NEW) pounds both convert with the platform rate; new = 100 old.
  const usd = convertMoney(value, currency, 'USD', rate.rate);
  if (!usd) return null;
  return {
    amount: usd.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
    fxRate: rate.rate,
    fxSource: rate.source,
  };
}
