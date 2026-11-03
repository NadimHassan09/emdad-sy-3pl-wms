import { wireCurrencyCode } from '../../../../common/money/currency';
import type {
  NormalizedTrackingStatus,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
} from '../../shipping-provider.interface';
import { SENA_EXPRESS_CODE } from '../../shipping.constants';
import type {
  SenaCreateShipmentPayload,
  SenaDeliveryZone,
  SenaItem,
  SenaShipment,
} from './sena-express.types';

export function parseSenaZoneIdFromServiceId(serviceId?: string | null): number | null {
  if (!serviceId) return null;
  const prefix = `${SENA_EXPRESS_CODE}:`;
  const normalized = serviceId.trim();
  if (normalized.toUpperCase().startsWith(prefix)) {
    const rest = normalized.slice(prefix.length).replace(/^zone_/i, '').trim();
    const id = Number(rest);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

export function matchSenaZone(
  zones: SenaDeliveryZone[],
  destination: {
    city?: string | null;
    governorate?: string | null;
    neighborhood?: string | null;
    address?: string | null;
  },
): SenaDeliveryZone | null {
  if (!zones || zones.length === 0) return null;

  const searchTerms = [
    destination.city,
    destination.governorate,
    destination.neighborhood,
    destination.address,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim().toLowerCase());

  for (const term of searchTerms) {
    const match = zones.find((z) => {
      const name = (z.name || '').toLowerCase();
      const code = (z.zone_code || '').toLowerCase();
      const display = (z.display_name || '').toLowerCase();
      const country = (z.country || '').toLowerCase();
      return (
        name.includes(term) ||
        term.includes(name) ||
        code === term ||
        (code.length >= 3 && term.includes(code)) ||
        display.includes(term) ||
        term.includes(display) ||
        country.includes(term) ||
        (country.length >= 3 && term.includes(country))
      );
    });
    if (match) return match;
  }

  // No evidence this destination is served. A merchant with a single zone has no other
  // option; with several zones, guessing the first would offer or route a wrong zone.
  return zones.length === 1 ? zones[0] : null;
}

export function formatPhoneForSena(country: string | null | undefined, local: string | null | undefined): string {
  const c = (country || '963').replace(/\D/g, '');
  const l = (local || '').replace(/\D/g, '').replace(/^0+/, '');
  return `${c}${l}`;
}

export function mapCreateShipmentPayload(
  input: ShippingCreateShipmentInput,
  deliveryZoneId: number,
): SenaCreateShipmentPayload {
  const customerPhone = formatPhoneForSena(input.receiver.phoneCountry, input.receiver.phoneLocal);
  const city = (input.receiver.city || input.receiver.governorate || 'Damascus').trim();
  const address = input.receiver.address.trim();
  const codAmount = input.codAmount && Number.isFinite(Number(input.codAmount)) ? Number(input.codAmount) : 0;
  const currency = codAmount > 0 ? wireCurrencyCode(input.currency) : undefined;

  let items: SenaItem[];
  const rawItems = (input as { items?: Array<{ name?: string; sku?: string; quantity?: number; price?: number; weight?: number; barcode?: string; product_id?: number }> }).items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    items = rawItems.map((item, idx) => ({
      name: item.name || `Item ${idx + 1}`,
      sku: item.sku || `SKU-${idx + 1}`,
      barcode: item.barcode,
      product_id: item.product_id,
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : codAmount,
      weight: item.weight != null && Number.isFinite(Number(item.weight)) ? Number(item.weight) : (input.weightKg || 1),
    }));
  } else if (Array.isArray(input.parts) && input.parts.length > 0) {
    items = input.parts.map((p, idx) => ({
      name: input.contents || `Part ${idx + 1}`,
      sku: input.reference ? `${input.reference}-${idx + 1}` : `PART-${idx + 1}`,
      quantity: 1,
      price: codAmount > 0 ? Math.round((codAmount / input.parts!.length) * 100) / 100 : 0,
      weight: p.weight > 0 ? p.weight : 1,
    }));
  } else {
    items = [
      {
        name: input.contents || 'Package',
        sku: input.reference || 'ITEM-1',
        quantity: 1,
        price: codAmount,
        weight: input.weightKg > 0 ? input.weightKg : 1,
      },
    ];
  }

  const payload: SenaCreateShipmentPayload = {
    reference: input.reference || `ORD-${Date.now()}`,
    fulfillment_type: 'merchant_prepared',
    delivery_zone_id: deliveryZoneId,
    area_id: deliveryZoneId,
    customer_name: input.receiver.name.trim(),
    customer_phone: customerPhone,
    city,
    address,
    cod_amount: codAmount,
    items,
    delivery_payment_type: input.payer === 'receiver' ? 'receiver' : 'sender',
    save_pickup_address: false,
  };

  if (currency) {
    payload.currency = currency;
  }

  if (input.pickup) {
    payload.pickup_address = {
      title: input.pickup.name || 'Warehouse',
      contact_name: input.pickup.name || 'Warehouse',
      phone: formatPhoneForSena(input.pickup.phoneCountry, input.pickup.phoneLocal),
      city: input.pickup.city || 'Damascus',
      address: input.pickup.address,
      notes: input.pickup.neighborhood || undefined,
    };
  }

  return payload;
}

export function mapSenaStatusToNormalized(senaStatus?: string | null): NormalizedTrackingStatus {
  if (!senaStatus) return 'unknown';
  const s = senaStatus.trim().toLowerCase();
  switch (s) {
    case 'pending':
    case 'awaiting_pickup':
    case 'awaiting_address_confirmation':
    case 'customer_confirmed':
    case 'rescheduled':
      return 'in_transit';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'client_no_response':
    case 'customer_not_responding':
    case 'phone_off':
    case 'refused':
    case 'delivery_attempts_completed':
    case 'delivery_failed':
      return 'delivery_failed';
    case 'in_return':
      return 'returning_to_sender';
    case 'returned_to_sender':
    case 'returned':
      return 'returned_to_sender';
    case 'cancelled':
      return 'cancelled';
    case 'shipment_problem':
    case 'damaged':
    case 'lost':
      return 'delivery_failed';
    default:
      return 'unknown';
  }
}

export function mapSenaShipmentToResult(shipment: SenaShipment): ShippingCreateShipmentResult {
  const awb = String(shipment.shipment_number || shipment.id || '').trim();
  const trackingNumber = String(
    shipment.shipment_number || shipment.shipment_reference || shipment.id || '',
  ).trim();

  let partBarcodes: string[] | undefined;
  if (Array.isArray(shipment.part_barcodes) && shipment.part_barcodes.length > 0) {
    partBarcodes = shipment.part_barcodes.map((b) => String(b).trim()).filter(Boolean);
  } else if (Array.isArray(shipment.parts) && shipment.parts.length > 0) {
    partBarcodes = shipment.parts.map((b) => String(b).trim()).filter(Boolean);
  }

  return {
    awb,
    trackingNumber: trackingNumber || awb,
    partBarcodes: partBarcodes && partBarcodes.length > 0 ? partBarcodes : undefined,
    raw: shipment,
  };
}
