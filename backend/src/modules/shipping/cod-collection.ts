import { convertMoney, currencyFamily, normalizeCurrency, type Currency } from '../../common/money/currency';
/** Whole Syrian pounds. 58 * 12345.67 = 716048.86, which rounds to 716049. */
export function roundWholeSyp(amount: number): number {
  return Math.round(amount);
}

export type CodCollection = {
  amount: number;
  currency: Currency;
  rate: number | null;
  source: string | null;
  rateAt: string | null;
  converted: boolean;
};

export type CodCollectionError = { error: 'missing_rate' | 'invalid_amount' };

export function normalizeMoneyCurrency(value: string | null | undefined): Currency {
  return normalizeCurrency(value);
}

/**
 * Convert the original order COD into the collection currency.
 * Same currency returns the original amount unchanged and does not require a rate.
 */
export function convertCodCollection(input: {
  orderAmount: number;
  orderCurrency: string | null | undefined;
  collectionCurrency: string | null | undefined;
  usdToSypRate: number | null;
  rateSource?: string | null;
  rateAt?: string | null;
}): CodCollection | CodCollectionError {
  const orderCurrency = normalizeMoneyCurrency(input.orderCurrency);
  const collectionCurrency = normalizeMoneyCurrency(
    input.collectionCurrency ?? input.orderCurrency,
  );
  const orderAmount = Number(input.orderAmount);
  if (!Number.isFinite(orderAmount) || orderAmount < 0) {
    return { error: 'invalid_amount' };
  }
  if (collectionCurrency === orderCurrency) {
    return {
      amount: orderAmount,
      currency: orderCurrency,
      rate: null,
      source: null,
      rateAt: null,
      converted: false,
    };
  }
  const rate = input.usdToSypRate;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return { error: 'missing_rate' };
  }
  // Old SYP, new SYP and USD all convert through USD with the platform rate (new pound = 100 old).
  const converted = convertMoney(orderAmount, orderCurrency, collectionCurrency, rate);
  if (!converted) return { error: 'missing_rate' };
  const raw = converted.toNumber();
  const amount = collectionCurrency === 'USD' ? Math.round(raw * 100) / 100 : roundWholeSyp(raw);
  return {
    amount,
    currency: collectionCurrency,
    rate,
    source: input.rateSource ?? null,
    rateAt: input.rateAt ?? null,
    converted: true,
  };
}

/**
 * A minimum is applied only when the caller passes one that a contract or a
 * recorded provider response confirmed. It is compared to the collection amount.
 */
export function codMinimumViolation(input: {
  collectionAmount: number;
  collectionCurrency: string;
  confirmedMinimum?: Partial<Record<'USD' | 'SYP', number>> | null;
}): { minimum: number; currency: 'USD' | 'SYP' } | null {
  const currency = currencyFamily(input.collectionCurrency);
  const minimum = input.confirmedMinimum?.[currency];
  if (minimum == null || !Number.isFinite(minimum) || minimum <= 0) return null;
  if (input.collectionAmount > 0 && input.collectionAmount < minimum) {
    return { minimum, currency };
  }
  return null;
}
