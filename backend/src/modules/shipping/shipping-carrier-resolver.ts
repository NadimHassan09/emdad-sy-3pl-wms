import type { Prisma } from '@prisma/client';
import { BABEL_EXPRESS_CODE, SENA_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';

export const KNOWN_COURIERS: Record<string, string> = {
  '9575208d-3587-4d23-84b3-cdc97d09b60e': 'كرم للشحن',
  '4e2a25c4-fadc-42ca-89c7-26e26d740fd7': 'مسارات',
  'fd4f088d-243b-4582-bb72-bb97c69b589c': 'ترابط',
  '3237a246-e521-461a-9417-ad859176e846': 'ديليفرو جود',
  '268f9ddf-a3b8-44bf-8bb3-cf06b2f22f1f': 'مرسال',
  '6e8fd4bb-f438-44c8-ad88-f1650512908b': 'الفاتح (Fatih Cargo)',
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
  if (lower.includes('sena') || trimmed.includes('سينا')) return 'شركة سينا (SENA Express)';
  if (lower === 'masarat' || lower.includes('مسارات')) return 'مسارات';
  if (lower.includes('karam') || lower.includes('كرم')) return 'كرم للشحن';
  if (lower === 'tarabut' || lower.includes('ترابط')) return 'ترابط';
  if (lower.includes('deliveroo') || lower.includes('ديليفرو')) return 'ديليفرو جود';
  if (lower.includes('mersal') || lower.includes('مرسال')) return 'مرسال';
  if (lower.includes('fatih') || lower.includes('الفاتح')) return 'الفاتح (Fatih Cargo)';
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
      status?: string | null;
      supersededAt?: Date | string | null;
      providerCode?: string | null;
      rawResultMeta?: any;
    }> | null;
  } | null;
};

function courierNameFromMeta(meta: unknown): { courierId: string | null; courierName: string | null } {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { courierId: null, courierName: null };
  }
  const record = meta as Record<string, unknown>;
  const nested =
    record.courier && typeof record.courier === 'object' && !Array.isArray(record.courier)
      ? (record.courier as Record<string, unknown>)
      : null;
  const courierId = [record.courier_id, record.courierId, nested?.id]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
  const courierName = [record.courier_name, record.courierName, nested?.name]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
  return {
    courierId: courierId?.trim().toLowerCase() || null,
    courierName: courierName?.trim() || null,
  };
}

function nameFromCourierId(courierId: string | null): string | null {
  if (!courierId) return null;
  if (KNOWN_COURIERS[courierId]) return KNOWN_COURIERS[courierId];
  if (dynamicCourierRegistry.has(courierId)) return dynamicCourierRegistry.get(courierId)!;
  return null;
}

export function serviceIdBelongsToProvider(
  serviceId: string | null | undefined,
  providerCode: string | null | undefined,
): boolean {
  const service = (serviceId || '').trim().toUpperCase();
  const code = (providerCode || '').trim().toUpperCase();
  if (!service || !code) return false;
  return service === code || service.startsWith(`${code}:`);
}

export function displayNameForProviderCode(providerCode: string | null | undefined): string | null {
  const code = (providerCode || '').trim().toUpperCase();
  if (code === BABEL_EXPRESS_CODE || code === 'BABEL') return 'Babel Express';
  if (code === SENA_EXPRESS_CODE || code === 'SENA') return 'شركة سينا (SENA Express)';
  return null;
}

/**
 * Resolve the actual shipping company name (not provider/aggregator like Sila).
 * The active shipment's provider identity always wins over leftover OMS/outbound
 * fields from a previous carrier (e.g. TARABUT after a successful Babel send).
 */
export function resolveShippingCarrierName(order: CarrierResolutionInput): string | null {
  const shipments = (order.outboundOrder?.carrierShipments ?? []).filter((shipment) => {
    if (shipment.supersededAt) return false;
    const status = (shipment.status || '').trim();
    return status !== 'failed' && status !== 'cancelled';
  });
  const activeShipment = shipments[0] ?? null;
  const activeProvider =
    activeShipment?.providerCode?.trim() ||
    order.outboundOrder?.shippingProviderCode?.trim() ||
    order.shippingProviderCode?.trim() ||
    '';

  if (activeShipment?.providerCode?.trim().toUpperCase() === BABEL_EXPRESS_CODE) {
    return 'Babel Express';
  }
  if (activeShipment?.providerCode?.trim().toUpperCase() === SENA_EXPRESS_CODE) {
    return 'شركة سينا (SENA Express)';
  }

  const fromMeta = courierNameFromMeta(activeShipment?.rawResultMeta);
  if (fromMeta.courierName && !isProviderName(fromMeta.courierName)) {
    if (
      activeShipment?.providerCode?.trim().toUpperCase() !== BABEL_EXPRESS_CODE &&
      activeShipment?.providerCode?.trim().toUpperCase() !== SENA_EXPRESS_CODE
    ) {
      return normalizeCourierDisplayName(fromMeta.courierName);
    }
  }
  const fromMetaId = nameFromCourierId(fromMeta.courierId);
  if (
    fromMetaId &&
    activeShipment?.providerCode?.trim().toUpperCase() !== BABEL_EXPRESS_CODE &&
    activeShipment?.providerCode?.trim().toUpperCase() !== SENA_EXPRESS_CODE
  ) {
    return fromMetaId;
  }

  const selectedProvider = (
    activeShipment?.providerCode ||
    order.outboundOrder?.shippingProviderCode ||
    order.shippingProviderCode ||
    ''
  ).trim();
  const fromSelected = displayNameForProviderCode(selectedProvider);
  if (fromSelected) return fromSelected;

  const serviceId =
    order.outboundOrder?.shippingServiceId?.trim() ||
    order.shippingServiceId?.trim();
  if (
    serviceId?.startsWith(`${SILA_SY_CODE}:`) &&
    (!selectedProvider || selectedProvider.toUpperCase() === SILA_SY_CODE) &&
    (!activeShipment?.providerCode ||
      activeShipment.providerCode.trim().toUpperCase() === SILA_SY_CODE)
  ) {
    const parts = serviceId.split(':');
    const courierId = parts.length >= 2 && parts[1].trim() ? parts[1].trim().toLowerCase() : null;
    const fromService = nameFromCourierId(courierId);
    if (fromService) return fromService;
  }

  const rawCarrier = order.outboundOrder?.carrier?.trim() || order.carrier?.trim();
  if (
    rawCarrier &&
    !isProviderName(rawCarrier) &&
    selectedProvider.toUpperCase() !== BABEL_EXPRESS_CODE &&
    selectedProvider.toUpperCase() !== SENA_EXPRESS_CODE &&
    activeShipment?.providerCode?.trim().toUpperCase() !== BABEL_EXPRESS_CODE &&
    activeShipment?.providerCode?.trim().toUpperCase() !== SENA_EXPRESS_CODE
  ) {
    return normalizeCourierDisplayName(rawCarrier);
  }

  if (rawCarrier && rawCarrier.toLowerCase().includes('babel')) {
    return 'Babel Express';
  }
  if (rawCarrier && (rawCarrier.toLowerCase().includes('sena') || rawCarrier.includes('سينا'))) {
    return 'شركة سينا (SENA Express)';
  }

  return displayNameForProviderCode(activeProvider);
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

  if (lower.includes('sena') || t.includes('سينا')) {
    orConditions.push(
      { shippingProviderCode: SENA_EXPRESS_CODE },
      { outboundOrder: { shippingProviderCode: SENA_EXPRESS_CODE } },
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
