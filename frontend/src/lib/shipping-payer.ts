import type { ShippingPayer } from '../api/shipping';

/**
 * Business-friendly shipping payment modes for Emdad WMS/OMS.
 *
 * - EMDAD_PAYS: Emdad settles shipping charges with the carrier; client (merchant)
 *   is billed separately by Emdad; recipient pays 0 shipping.
 * - RECIPIENT_PAYS: Recipient pays shipping fee directly to the carrier upon delivery.
 */
export type ShippingPaymentMode = 'EMDAD_PAYS' | 'RECIPIENT_PAYS';

export const DEFAULT_SHIPPING_PAYMENT_MODE: ShippingPaymentMode = 'EMDAD_PAYS';

export const SHIPPING_PAYMENT_MODE_OPTIONS: ReadonlyArray<{
  value: ShippingPaymentMode;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}> = [
  {
    value: 'EMDAD_PAYS',
    labelEn: 'Emdad Pays',
    labelAr: 'إمداد تتحمل تكلفة الشحن',
    descriptionEn: 'Emdad settles shipping fee with carrier; client billed separately; recipient pays 0 shipping.',
    descriptionAr: 'إمداد تسدد أجور الشحن مع شركة الشحن وتفوتر العميل بشكل منفصل، ولا يدفع المستلم أجور شحن.',
  },
  {
    value: 'RECIPIENT_PAYS',
    labelEn: 'Recipient Pays',
    labelAr: 'المستلم يتحمل تكلفة الشحن',
    descriptionEn: 'Recipient pays shipping fee directly to the carrier upon delivery.',
    descriptionAr: 'المستلم يدفع أجور الشحن مباشرة لشركة الشحن عند الاستلام.',
  },
] as const;

/** Canonical carrier codes recognized by Emdad integrations. */
export const CARRIER_CODES = {
  BABEL_EXPRESS: 'BABEL_EXPRESS',
  SILA_SY: 'SILA_SY',
  SENA_EXPRESS: 'SENA_EXPRESS',
  DELIVERY_JOUD: 'DELIVERY_JOUD',
  FATIH_CARGO: 'FATIH_CARGO',
  MOCK_CARRIER: 'MOCK_CARRIER',
  MANUAL: 'MANUAL',
} as const;

/**
 * Normalizes an arbitrary carrier string into a canonical provider key.
 */
export function normalizeCarrierCode(carrier?: string | null): string {
  if (!carrier) return '';
  const trimmed = carrier.trim().toUpperCase();
  if (trimmed === 'BABEL' || trimmed.startsWith('BABEL_') || trimmed.includes('BABEL')) {
    return CARRIER_CODES.BABEL_EXPRESS;
  }
  if (trimmed === 'SILA' || trimmed.startsWith('SILA_') || trimmed.includes('SILA')) {
    return CARRIER_CODES.SILA_SY;
  }
  if (trimmed === 'SENA' || trimmed.startsWith('SENA_') || trimmed.includes('SENA')) {
    return CARRIER_CODES.SENA_EXPRESS;
  }
  if (
    trimmed === 'DELIVERY_JOUD' ||
    trimmed.includes('DELIVERY_JOUD') ||
    trimmed.includes('JOUD') ||
    trimmed.includes('DELIVEROO')
  ) {
    return CARRIER_CODES.DELIVERY_JOUD;
  }
  if (trimmed === 'FATIH_CARGO' || trimmed.includes('FATIH') || trimmed.includes('الفاتح')) {
    return CARRIER_CODES.FATIH_CARGO;
  }
  if (trimmed === 'MOCK' || trimmed.startsWith('MOCK_') || trimmed.includes('MOCK')) {
    return CARRIER_CODES.MOCK_CARRIER;
  }
  if (trimmed === 'MANUAL') {
    return CARRIER_CODES.MANUAL;
  }
  return trimmed;
}

/**
 * Translates an internal or stored payer string into the business payment mode.
 *
 * Stored 'sender' and 'reseller' are both interpreted as EMDAD_PAYS.
 * Stored 'receiver' is interpreted as RECIPIENT_PAYS.
 * Missing / unset defaults to EMDAD_PAYS.
 */
export function resolvePaymentModeFromPayer(
  payer?: ShippingPayer | string | null,
): ShippingPaymentMode {
  if (payer === 'receiver') {
    return 'RECIPIENT_PAYS';
  }
  return 'EMDAD_PAYS';
}

/**
 * Maps the user's business payment mode to the exact technical payer string
 * expected by the selected shipping carrier's API contract.
 *
 * - RECIPIENT_PAYS: 'receiver' for all carriers.
 * - EMDAD_PAYS:
 *     - Babel Express -> 'reseller'
 *     - Sila-SY -> 'sender'
 *     - Sena Express -> 'sender'
 *     - Delivery Joud -> 'sender' (delivery_fee_on_sender)
 *     - Fatih Cargo -> 'sender'
 *     - Mock Carrier -> 'reseller'
 *     - Manual / unassigned -> 'sender'
 *
 * Throws an Error for unknown non-empty carriers to avoid silent invalid payloads.
 */
export function mapPayerForCarrier(
  mode: ShippingPaymentMode,
  carrier?: string | null,
): ShippingPayer {
  if (mode === 'RECIPIENT_PAYS') {
    return 'receiver';
  }

  const normalized = normalizeCarrierCode(carrier);

  switch (normalized) {
    case CARRIER_CODES.BABEL_EXPRESS:
      return 'reseller';

    case CARRIER_CODES.SILA_SY:
      return 'sender';

    case CARRIER_CODES.SENA_EXPRESS:
      return 'sender';

    case CARRIER_CODES.DELIVERY_JOUD:
      return 'sender';

    case CARRIER_CODES.FATIH_CARGO:
      return 'sender';

    case CARRIER_CODES.MOCK_CARRIER:
      return 'reseller';

    case CARRIER_CODES.MANUAL:
    case '':
      return 'sender';

    default:
      throw new Error(`Unsupported carrier payer mapping: ${carrier}`);
  }
}

/**
 * User-facing display label for the business payment mode.
 */
export function formatPaymentModeLabel(
  mode: ShippingPaymentMode,
  isArabic = false,
): string {
  if (mode === 'RECIPIENT_PAYS') {
    return isArabic ? 'المستلم يتحمل تكلفة الشحن' : 'Recipient Pays';
  }
  return isArabic ? 'إمداد تتحمل تكلفة الشحن' : 'Emdad Pays';
}

/**
 * User-facing display label for a stored or order-level payer value.
 */
export function formatStoredPayerLabel(
  payer?: ShippingPayer | string | null,
  isArabic = false,
): string {
  const mode = resolvePaymentModeFromPayer(payer);
  return formatPaymentModeLabel(mode, isArabic);
}
