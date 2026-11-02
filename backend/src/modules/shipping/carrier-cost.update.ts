import {
  BABEL_EXPRESS_CODE,
  MOCK_CARRIER_CODE,
  SENA_EXPRESS_CODE,
  SILA_SY_CODE,
} from './shipping.constants';

/**
 * Actual carrier cost extracted only from fields the provider uses for its own shipping price.
 * Quote totals, COD, and the client shipping rate are intentionally ignored.
 *
 * Babel webhooks and trackShipment do not document a revised-cost field. When a payload
 * includes `details.shipping` or `shipping_cost`, that value is stored. Top-level `price`
 * is the calculatePrice total and is not treated as a cost update.
 *
 * Sila (including Tarabut, which is a Sila courier) exposes `delivery_fee` on quote and cargo
 * records. Tracking webhooks often omit it. Polling the cargo record picks it up when present.
 * There is no separate Tarabut cost API.
 */

export type VerifiedCarrierCost = {
  amount: number;
  currency: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finiteAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function currencyOf(record: Record<string, unknown> | null): string | null {
  const raw = record?.currency;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().toUpperCase();
}

function firstAmount(records: Array<Record<string, unknown> | null>, keys: string[]): {
  amount: number;
  source: Record<string, unknown>;
} | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const amount = finiteAmount(record[key]);
      if (amount != null) return { amount, source: record };
    }
  }
  return null;
}

export function extractVerifiedCarrierCost(
  providerCode: string,
  raw: unknown,
): VerifiedCarrierCost | null {
  const body = asRecord(raw);
  if (!body) return null;
  const details = asRecord(body.details);
  const shipment = asRecord(body.shipment);
  const firstShipment = Array.isArray(body.shipments) ? asRecord(body.shipments[0]) : null;
  const code = providerCode.trim().toUpperCase();

  if (code === BABEL_EXPRESS_CODE) {
    const found = firstAmount([details, body], ['shipping', 'shipping_cost', 'shippingCost']);
    if (!found) return null;
    return { amount: found.amount, currency: currencyOf(found.source) ?? currencyOf(body) ?? currencyOf(details) };
  }

  if (code === SILA_SY_CODE) {
    const found = firstAmount([body, shipment, firstShipment], ['delivery_fee', 'deliveryFee']);
    if (!found) return null;
    return {
      amount: found.amount,
      currency: currencyOf(found.source) ?? currencyOf(body) ?? currencyOf(shipment),
    };
  }

  if (code === SENA_EXPRESS_CODE) {
    const found = firstAmount([body, shipment], ['delivery_price', 'shipping_cost', 'shippingCost']);
    if (!found) return null;
    return {
      amount: found.amount,
      currency: currencyOf(found.source) ?? currencyOf(body) ?? currencyOf(shipment),
    };
  }

  if (code === MOCK_CARRIER_CODE) {
    const found = firstAmount([body], ['shipping_cost', 'shippingCost']);
    if (!found) return null;
    return { amount: found.amount, currency: currencyOf(body) };
  }

  const found = firstAmount([body, details], ['shipping_cost', 'shippingCost']);
  if (!found) return null;
  return { amount: found.amount, currency: currencyOf(found.source) ?? currencyOf(body) };
}

export type StoredCarrierCost = {
  amount: number | null;
  currency: string | null;
  eventAt: Date | null;
  appliedEventIds: string[];
};

export type CarrierCostDecision =
  | { action: 'ignored_no_cost' }
  | { action: 'skipped_duplicate' }
  | { action: 'skipped_stale' }
  | { action: 'unchanged' }
  | {
      action: 'applied';
      amount: number;
      currency: string | null;
      previousAmount: number | null;
      previousCurrency: string | null;
    };

export function decideCarrierCostUpdate(input: {
  providerCode: string;
  raw: unknown;
  externalEventId?: string | null;
  eventAt?: Date | null;
  stored: StoredCarrierCost;
}): CarrierCostDecision {
  const eventId = input.externalEventId?.trim() || null;
  if (eventId && input.stored.appliedEventIds.includes(eventId)) {
    return { action: 'skipped_duplicate' };
  }

  const verified = extractVerifiedCarrierCost(input.providerCode, input.raw);
  if (!verified) return { action: 'ignored_no_cost' };

  const incomingAt = input.eventAt ?? null;
  if (input.stored.eventAt && incomingAt && incomingAt.getTime() < input.stored.eventAt.getTime()) {
    return { action: 'skipped_stale' };
  }
  if (
    input.stored.eventAt &&
    incomingAt &&
    incomingAt.getTime() === input.stored.eventAt.getTime() &&
    input.stored.amount != null
  ) {
    return { action: 'skipped_stale' };
  }

  if (
    input.stored.amount != null &&
    input.stored.amount === verified.amount &&
    (input.stored.currency ?? null) === verified.currency
  ) {
    return { action: 'unchanged' };
  }

  return {
    action: 'applied',
    amount: verified.amount,
    currency: verified.currency,
    previousAmount: input.stored.amount,
    previousCurrency: input.stored.currency,
  };
}
