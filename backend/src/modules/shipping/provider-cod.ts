import { convertCodCollection, normalizeMoneyCurrency, type CodCollection } from './cod-collection';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';

export type CodCurrency = 'USD' | 'SYP';

/**
 * Capability is not a provider-wide list. An entry exists only when a recorded
 * create accepted that currency for the same provider, service, and delivery type.
 * Unknown configurations stay empty. Quote currency is not evidence.
 *
 * Sila TARABUT home + USD: cargo 36b41ddb-c312-4e45-afda-08299ad52317,
 * service SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:…, delivery address.
 * Babel hub + USD: AWB 260308790655, service BABEL_EXPRESS:hub.
 */
export const VERIFIED_TARABUT_COURIER_ID = 'fd4f088d-243b-4582-bb72-bb97c69b589c';

export type ProviderCodCapability = {
  supportedCodCurrencies: CodCurrency[];
  codMinimum: Partial<Record<CodCurrency, number>>;
};

export type ServiceCodIdentity = {
  providerCode?: string | null;
  serviceName?: string | null;
  serviceId?: string | null;
  deliveryType?: string | null;
};

const EMPTY: ProviderCodCapability = {
  supportedCodCurrencies: [],
  codMinimum: {},
};

export function normalizeDeliveryType(
  value?: string | null,
): 'address' | 'hub' | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'hub' || v === 'branch' || v === 'pickup_at_branch') return 'hub';
  if (v === 'address' || v === 'home' || v === 'home_delivery') return 'address';
  return null;
}

/** Verified COD currencies for this provider + service + delivery type. Empty means unknown. */
export function verifiedCodCurrencies(identity: ServiceCodIdentity): CodCurrency[] {
  const code = identity.providerCode?.trim().toUpperCase() ?? '';
  const delivery = normalizeDeliveryType(identity.deliveryType);
  const serviceId = (identity.serviceId ?? '').trim();
  const name = (identity.serviceName ?? '').trim();

  if (code === SILA_SY_CODE) {
    const home = delivery === 'address';
    const tarabut =
      /\bTARABUT\b/i.test(name) ||
      serviceId.toLowerCase().includes(VERIFIED_TARABUT_COURIER_ID);
    if (home && tarabut) return ['USD'];
    return [];
  }

  if (code === BABEL_EXPRESS_CODE || code === 'BABEL') {
    const hub = delivery === 'hub' || /:hub$/i.test(serviceId);
    if (hub) return ['USD'];
    return [];
  }

  return [];
}

/** Provider-only lookup is not evidence. Use verifiedCodCurrencies with a service. */
export function providerCodCapability(_providerCode: string | null | undefined): ProviderCodCapability {
  return EMPTY;
}

export function providerSupportsCodCurrency(
  providerCode: string | null | undefined,
  currency: string | null | undefined,
  identity?: ServiceCodIdentity,
): boolean {
  const cur = currency?.trim().toUpperCase();
  if (cur !== 'USD' && cur !== 'SYP') return false;
  return verifiedCodCurrencies({ ...identity, providerCode }).includes(cur);
}

export type CollectionResolution =
  | (CodCollection & { ok: true })
  | { ok: false; reason: string; code: 'unsupported' | 'missing_rate' | 'invalid_amount' };

/**
 * All preserves the original currency when that service supports it.
 * Conversion runs only when the original currency is unsupported, another
 * verified COD currency exists, and a FX rate exists. The shipping-fee
 * currency is not an input and cannot trigger conversion.
 * Explicit mode never substitutes a different currency.
 */
export function resolveCollectionForService(input: {
  providerCode?: string | null;
  serviceName?: string | null;
  serviceId?: string | null;
  deliveryType?: string | null;
  orderAmount: number;
  orderCurrency?: string | null;
  requestedCurrency?: string | null;
  mode: 'all' | 'explicit';
  usdToSypRate: number | null;
  rateSource?: string | null;
  rateAt?: string | null;
}): CollectionResolution {
  const orderAmount = Number(input.orderAmount);
  if (!Number.isFinite(orderAmount) || orderAmount < 0) {
    return { ok: false, code: 'invalid_amount', reason: 'COD amount is not a valid number.' };
  }
  if (orderAmount === 0) {
    return {
      ok: true,
      amount: 0,
      currency: normalizeMoneyCurrency(input.orderCurrency),
      rate: null,
      source: null,
      rateAt: null,
      converted: false,
    };
  }

  const orderCurrency = normalizeMoneyCurrency(input.orderCurrency);
  const requested = input.requestedCurrency
    ? normalizeMoneyCurrency(input.requestedCurrency)
    : orderCurrency;
  // All keeps the order currency. Explicit uses the currency the user selected.
  // Fee currency is not an input and does not choose the target.
  const target: CodCurrency = input.mode === 'explicit' ? requested : orderCurrency;

  const converted = convertCodCollection({
    orderAmount,
    orderCurrency,
    collectionCurrency: target,
    usdToSypRate: input.usdToSypRate,
    rateSource: input.rateSource,
    rateAt: input.rateAt,
  });
  if ('error' in converted) {
    return {
      ok: false,
      code: converted.error === 'missing_rate' ? 'missing_rate' : 'invalid_amount',
      reason:
        converted.error === 'missing_rate'
          ? 'No USD/SYP exchange rate is available for this COD conversion.'
          : 'COD amount is not a valid number.',
    };
  }
  return { ok: true, ...converted };
}
