import type { Prisma } from '@prisma/client';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';

export const KNOWN_COURIERS: Record<string, string> = {
  '9575208d-3587-4d23-84b3-cdc97d09b60e': 'كرم للشحن',
  '4e2a25c4-fadc-42ca-89c7-26e26d740fd7': 'مسارات',
  'fd4f088d-243b-4582-bb72-bb97c69b589c': 'ترابط',
  '3237a246-e521-461a-9417-ad859176e846': 'ديليفرو جود',
  '268f9ddf-a3b8-44bf-8bb3-cf06b2f22f1f': 'مرسال',
};

const dynamicCourierRegistry = new Map<string, string>();

/**
 * Register a dynamic courier name (e.g. from live Sila rate quotes).
 */
export function registerCourierName(courierId: string, name: string): void {
  if (!courierId || !name) return;
  const key = courierId.trim().toLowerCase();
  dynamicCourierRegistry.set(key, normalizeCourierDisplayName(name));
}

/**
 * Normalize carrier name for display.
 */
export function normalizeCourierDisplayName(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('babel')) return 'Babel Express';
  if (lower === 'masarat' || lower.includes('مسارات')) return 'مسارات';
  if (lower.includes('karam') || lower.includes('كرم')) return 'كرم للشحن';
  if (lower === 'tarabut' || lower.includes('ترابط')) return 'ترابط';
  if (lower.includes('deliveroo') || lower.includes('ديليفرو')) return 'ديليفرو جود';
  if (lower.includes('mersal') || lower.includes('مرسال')) return 'مرسال';
  if (lower.includes('takamol') || lower.includes('تكامل')) return 'تكامل';
  return trimmed;
}

/**
 * Returns true if a carrier string represents an aggregator/provider name rather than the courier.
 */
export function isProviderName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return (
    lower.includes('sila') ||
    lower.includes('صلة') ||
    lower === 'manual'
  );
}

export type CarrierResolutionInput = {
  carrier?: string | null;
  shippingProviderCode?: string | null;
  shippingServiceId?: string | null;
  outboundOrder?: {
    carrier?: string | null;
    shippingProviderCode?: string | null;
    shippingServiceId?: string | null;
    carrierShipments?: Array<{
      providerCode?: string | null;
      rawResultMeta?: any;
    }> | null;
  } | null;
};

/**
 * Resolve the actual shipping company name (not provider/aggregator like Sila).
 */
export function resolveShippingCarrierName(order: CarrierResolutionInput): string | null {
  // 1. If carrier is set and not a generic provider/gateway name
  const rawCarrier = order.carrier?.trim() || order.outboundOrder?.carrier?.trim();
  if (rawCarrier && !isProviderName(rawCarrier)) {
    return normalizeCourierDisplayName(rawCarrier);
  }

  // 2. Extract courierId from shippingServiceId
  const serviceId =
    order.shippingServiceId?.trim() ||
    order.outboundOrder?.shippingServiceId?.trim();
  let courierId: string | null = null;
  if (serviceId && serviceId.startsWith(`${SILA_SY_CODE}:`)) {
    const parts = serviceId.split(':');
    if (parts.length >= 2 && parts[1].trim()) {
      courierId = parts[1].trim().toLowerCase();
    }
  }

  // 3. Extract courierId from carrierShipments rawResultMeta
  if (!courierId && order.outboundOrder?.carrierShipments?.length) {
    for (const cs of order.outboundOrder.carrierShipments) {
      const meta = cs.rawResultMeta as any;
      if (meta && typeof meta.courier_id === 'string' && meta.courier_id.trim()) {
        courierId = meta.courier_id.trim().toLowerCase();
        break;
      }
    }
  }

  if (courierId) {
    if (KNOWN_COURIERS[courierId]) {
      return KNOWN_COURIERS[courierId];
    }
    if (dynamicCourierRegistry.has(courierId)) {
      return dynamicCourierRegistry.get(courierId)!;
    }
  }

  // 4. Provider code fallback
  const providerCode =
    order.shippingProviderCode?.trim() ||
    order.outboundOrder?.shippingProviderCode?.trim();
  if (providerCode === BABEL_EXPRESS_CODE || (rawCarrier && rawCarrier.toLowerCase().includes('babel'))) {
    return 'Babel Express';
  }

  // Never return aggregator/provider name as carrier
  return null;
}

/**
 * Build Prisma WHERE condition for filtering OMS orders by carrier name.
 * Matches orders where carrier is set, or orders linked via shippingServiceId or providerCode.
 */
export function buildCarrierFilterPrismaCondition(rawCarrier: string): Prisma.OmsOrderWhereInput {
  const t = rawCarrier.trim();
  const lower = t.toLowerCase();

  const orConditions: Prisma.OmsOrderWhereInput[] = [
    { carrier: { contains: t, mode: 'insensitive' } },
    { outboundOrder: { carrier: { contains: t, mode: 'insensitive' } } },
  ];

  if (lower.includes('babel') || t.includes('بابل')) {
    orConditions.push(
      { shippingProviderCode: BABEL_EXPRESS_CODE },
      { outboundOrder: { shippingProviderCode: BABEL_EXPRESS_CODE } },
    );
  }

  // Check against known courier UUIDs
  for (const [uuid, name] of Object.entries(KNOWN_COURIERS)) {
    if (
      lower.includes(uuid) ||
      name.toLowerCase().includes(lower) ||
      lower.includes(name.toLowerCase()) ||
      (lower.includes('karam') && name.includes('كرم')) ||
      (lower.includes('masarat') && name.includes('مسارات')) ||
      (lower.includes('tarabut') && name.includes('ترابط')) ||
      (lower.includes('deliveroo') && name.includes('ديليفرو')) ||
      (lower.includes('mersal') && name.includes('مرسال'))
    ) {
      orConditions.push(
        { shippingServiceId: { contains: uuid, mode: 'insensitive' } },
        { outboundOrder: { shippingServiceId: { contains: uuid, mode: 'insensitive' } } },
      );
    }
  }

  return { OR: orConditions };
}
