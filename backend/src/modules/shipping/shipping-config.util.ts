import { BadRequestException } from '@nestjs/common';
import {
  ShippingDeliveryType,
  ShippingMethod,
  ShippingPackageType,
  ShippingPayer,
  ShippingPickupType,
} from '@prisma/client';

import {
  callingCodeForIso,
  isoFromCountryHint,
} from '../../common/validators/recipient-contact';

export const SHIPPING_LOCKED_STATUSES = new Set([
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
]);

/** Method/provider locked after successful carrier send or once past shipping-details stage. */
export const SHIPPING_IDENTITY_LOCKED_STATUSES = new Set([
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
]);

export type ShippingConfigFields = {
  shippingMethod?: ShippingMethod | null;
  shippingProviderCode?: string | null;
  shippingReceiverLat?: number | string | null;
  shippingReceiverLng?: number | string | null;
  shippingPackageType?: ShippingPackageType | null;
  shippingContents?: string | null;
  shippingDeliveryType?: ShippingDeliveryType | null;
  shippingPickupType?: ShippingPickupType | null;
  shippingPayer?: ShippingPayer | null;
  shippingWeightKg?: number | string | null;
  shippingVolumeCbm?: number | string | null;
  shippingPhoneCountry?: string | null;
  /** Babel neighbourhood id — preferred carrier destination identity. */
  babelNeighbourhoodId?: number | null;
};

export function isShippingConfigLocked(outboundStatus: string | null | undefined): boolean {
  if (!outboundStatus) return false;
  return SHIPPING_LOCKED_STATUSES.has(outboundStatus);
}

export function assertShippingConfigUnlocked(outboundStatus: string | null | undefined): void {
  if (isShippingConfigLocked(outboundStatus)) {
    throw new BadRequestException(
      'Shipping settings are locked after the order reaches ready_to_ship (Waiting for Dispatch).',
    );
  }
}

/** OMS / early outbound: method + provider only (no package/carrier payload yet). */
export function assertShippingIntentReady(fields: ShippingConfigFields): void {
  if ((fields.shippingMethod ?? ShippingMethod.manual) !== ShippingMethod.carrier) {
    return;
  }
  if (!fields.shippingProviderCode?.trim()) {
    throw new BadRequestException('shippingProviderCode is required when shippingMethod=carrier.');
  }
}

/** Babel Express typically rejects box weights above this (same opaque API error). */
export const BABEL_MAX_BOX_WEIGHT_KG = 200;

/** Full Babel/carrier payload — only required at Send Shipment. */
export function assertCarrierShippingReady(fields: ShippingConfigFields): void {
  if ((fields.shippingMethod ?? ShippingMethod.manual) !== ShippingMethod.carrier) {
    return;
  }
  assertShippingIntentReady(fields);
  const babelHood =
    fields.babelNeighbourhoodId != null ? Number(fields.babelNeighbourhoodId) : null;
  const hasBabelHood = babelHood != null && Number.isFinite(babelHood) && babelHood > 0;
  const lat = fields.shippingReceiverLat != null ? Number(fields.shippingReceiverLat) : NaN;
  const lng = fields.shippingReceiverLng != null ? Number(fields.shippingReceiverLng) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (!hasBabelHood && !hasCoords) {
    throw new BadRequestException(
      'Babel neighbourhood id (resolved from Governorate / City / Town) or receiver lat/lng is required when shipping via a carrier.',
    );
  }
  if (!fields.shippingPackageType) {
    throw new BadRequestException('shippingPackageType is required when shipping via a carrier.');
  }
  if (!fields.shippingContents?.trim()) {
    throw new BadRequestException('shippingContents is required when shipping via a carrier.');
  }
  if (!fields.shippingDeliveryType) {
    throw new BadRequestException('shippingDeliveryType is required when shipping via a carrier.');
  }
  if (!fields.shippingPickupType) {
    throw new BadRequestException('shippingPickupType is required when shipping via a carrier.');
  }
  if (!fields.shippingPayer) {
    throw new BadRequestException('shippingPayer is required when shipping via a carrier.');
  }
  const weight = Number(fields.shippingWeightKg);
  if (fields.shippingWeightKg == null || !Number.isFinite(weight) || weight <= 0) {
    throw new BadRequestException(
      'shippingWeightKg must be a positive number when shipping via a carrier.',
    );
  }
  if (fields.shippingPackageType === ShippingPackageType.envelope && weight !== 1) {
    throw new BadRequestException('Envelope shipments must weigh exactly 1 kg (Babel Express rule).');
  }
  if (fields.shippingPackageType === ShippingPackageType.box && weight > BABEL_MAX_BOX_WEIGHT_KG) {
    throw new BadRequestException(
      `Shipment weight ${weight} kg is too high for Babel Express (max ${BABEL_MAX_BOX_WEIGHT_KG} kg for a box). Enter the actual package weight in kilograms — not COD amount or currency.`,
    );
  }
  if (fields.shippingPhoneCountry != null && fields.shippingPhoneCountry.trim() !== '') {
    assertShippingPhoneCountry(fields.shippingPhoneCountry);
  }
}

/** Dial code like 963 (or SY / EG → calling code). Rejects amounts mistaken for country codes. */
export function assertShippingPhoneCountry(raw: string): void {
  const normalized = normalizeShippingPhoneCountry(raw);
  if (!normalized) {
    throw new BadRequestException(
      'Phone country must be a dial code (e.g. 963) or ISO code (e.g. SY) — not an amount or postal code.',
    );
  }
}

export function normalizeShippingPhoneCountry(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const iso = isoFromCountryHint(t);
  if (iso) return callingCodeForIso(iso);
  const digits = t.replace(/\D/g, '');
  if (!digits || digits.length < 1 || digits.length > 4) return null;
  // Guard against COD/fee amounts pasted into the dial-code field.
  if (Number(digits) >= 1000) return null;
  return digits;
}

export function shippingPrismaData(fields: ShippingConfigFields) {
  const data: Record<string, unknown> = {};
  if (fields.shippingMethod !== undefined) data.shippingMethod = fields.shippingMethod;
  if (fields.shippingProviderCode !== undefined) {
    data.shippingProviderCode = fields.shippingProviderCode;
  }
  if (fields.shippingReceiverLat !== undefined) {
    data.shippingReceiverLat =
      fields.shippingReceiverLat == null ? null : fields.shippingReceiverLat;
  }
  if (fields.shippingReceiverLng !== undefined) {
    data.shippingReceiverLng =
      fields.shippingReceiverLng == null ? null : fields.shippingReceiverLng;
  }
  if (fields.shippingPackageType !== undefined) {
    data.shippingPackageType = fields.shippingPackageType;
  }
  if (fields.shippingContents !== undefined) data.shippingContents = fields.shippingContents;
  if (fields.shippingDeliveryType !== undefined) {
    data.shippingDeliveryType = fields.shippingDeliveryType;
  }
  if (fields.shippingPickupType !== undefined) {
    data.shippingPickupType = fields.shippingPickupType;
  }
  if (fields.shippingPayer !== undefined) data.shippingPayer = fields.shippingPayer;
  if (fields.shippingWeightKg !== undefined) {
    data.shippingWeightKg =
      fields.shippingWeightKg == null ? null : fields.shippingWeightKg;
  }
  if (fields.shippingVolumeCbm !== undefined) {
    data.shippingVolumeCbm =
      fields.shippingVolumeCbm == null ? null : fields.shippingVolumeCbm;
  }
  if (fields.shippingPhoneCountry !== undefined) {
    if (fields.shippingPhoneCountry == null || fields.shippingPhoneCountry === '') {
      data.shippingPhoneCountry = null;
    } else {
      const iso = isoFromCountryHint(fields.shippingPhoneCountry);
      data.shippingPhoneCountry =
        iso ??
        normalizeShippingPhoneCountry(fields.shippingPhoneCountry) ??
        fields.shippingPhoneCountry.trim();
    }
  }
  if (fields.babelNeighbourhoodId !== undefined) {
    data.babelNeighbourhoodId =
      fields.babelNeighbourhoodId == null ? null : Number(fields.babelNeighbourhoodId);
  }
  return data;
}

export function copyShippingFieldsFromOms(oms: {
  shippingMethod?: ShippingMethod | null;
  shippingProviderCode?: string | null;
  shippingReceiverLat?: { toString(): string } | number | string | null;
  shippingReceiverLng?: { toString(): string } | number | string | null;
  shippingPackageType?: ShippingPackageType | null;
  shippingContents?: string | null;
  shippingDeliveryType?: ShippingDeliveryType | null;
  shippingPickupType?: ShippingPickupType | null;
  shippingPayer?: ShippingPayer | null;
  shippingWeightKg?: { toString(): string } | number | string | null;
  shippingVolumeCbm?: { toString(): string } | number | string | null;
  shippingPhoneCountry?: string | null;
  babelNeighbourhoodId?: number | null;
}) {
  return {
    shippingMethod: oms.shippingMethod ?? ShippingMethod.manual,
    shippingProviderCode: oms.shippingProviderCode ?? null,
    shippingReceiverLat:
      oms.shippingReceiverLat == null ? null : oms.shippingReceiverLat.toString(),
    shippingReceiverLng:
      oms.shippingReceiverLng == null ? null : oms.shippingReceiverLng.toString(),
    shippingPackageType: oms.shippingPackageType ?? null,
    shippingContents: oms.shippingContents ?? null,
    shippingDeliveryType: oms.shippingDeliveryType ?? null,
    shippingPickupType: oms.shippingPickupType ?? null,
    shippingPayer: oms.shippingPayer ?? null,
    shippingWeightKg:
      oms.shippingWeightKg == null ? null : oms.shippingWeightKg.toString(),
    shippingVolumeCbm:
      oms.shippingVolumeCbm == null ? null : oms.shippingVolumeCbm.toString(),
    shippingPhoneCountry: oms.shippingPhoneCountry ?? null,
    babelNeighbourhoodId: oms.babelNeighbourhoodId ?? null,
  };
}

const SHIPPING_PATCH_KEYS: (keyof ShippingConfigFields)[] = [
  'shippingMethod',
  'shippingProviderCode',
  'shippingReceiverLat',
  'shippingReceiverLng',
  'shippingPackageType',
  'shippingContents',
  'shippingDeliveryType',
  'shippingPickupType',
  'shippingPayer',
  'shippingWeightKg',
  'shippingVolumeCbm',
  'shippingPhoneCountry',
  'babelNeighbourhoodId',
];

export function hasShippingConfigPatch(fields: ShippingConfigFields): boolean {
  return SHIPPING_PATCH_KEYS.some((k) => fields[k] !== undefined);
}

/** Sum product.weightKg * qty; returns null if no line has a usable weight. */
export function sumLineWeightsKg(
  lines: Array<{ productId: string; requestedQuantity: number | string }>,
  weightByProductId: Map<string, number | string | null | undefined>,
): number | null {
  let sum = 0;
  let any = false;
  for (const line of lines) {
    const w = weightByProductId.get(line.productId);
    if (w == null || w === '') continue;
    const weight = Number(w);
    const qty = Number(line.requestedQuantity);
    if (!Number.isFinite(weight) || !Number.isFinite(qty) || weight < 0 || qty <= 0) {
      continue;
    }
    any = true;
    sum += weight * qty;
  }
  return any ? Math.round(sum * 10000) / 10000 : null;
}

/** Authoritative order weight: Σ(unitWeight × quantity). */
export const calculateOrderWeight = sumLineWeightsKg;

/** Sum product.volumeCbm * qty; returns null if no line has a usable volume. */
export function sumLineVolumesCbm(
  lines: Array<{ productId: string; requestedQuantity: number | string }>,
  volumeByProductId: Map<string, number | string | null | undefined>,
): number | null {
  let sum = 0;
  let any = false;
  for (const line of lines) {
    const v = volumeByProductId.get(line.productId);
    if (v == null || v === '') continue;
    const volume = Number(v);
    const qty = Number(line.requestedQuantity);
    if (!Number.isFinite(volume) || !Number.isFinite(qty) || volume < 0 || qty <= 0) {
      continue;
    }
    any = true;
    sum += volume * qty;
  }
  return any ? Math.round(sum * 1_000_000) / 1_000_000 : null;
}

/** Authoritative order volume: Σ(unitVolume × quantity). */
export const calculateOrderVolume = sumLineVolumesCbm;

export function resolveShippingWeightKg(params: {
  method: ShippingMethod | null | undefined;
  explicit: number | string | null | undefined;
  lines: Array<{ productId: string; requestedQuantity: number | string }>;
  weightByProductId: Map<string, number | string | null | undefined>;
}): number | null | undefined {
  if (params.explicit !== undefined) {
    return params.explicit == null ? null : Number(params.explicit);
  }
  if ((params.method ?? ShippingMethod.manual) !== ShippingMethod.carrier) {
    return undefined;
  }
  return calculateOrderWeight(params.lines, params.weightByProductId);
}

export function resolveShippingVolumeCbm(params: {
  method: ShippingMethod | null | undefined;
  explicit: number | string | null | undefined;
  lines: Array<{ productId: string; requestedQuantity: number | string }>;
  volumeByProductId: Map<string, number | string | null | undefined>;
}): number | null | undefined {
  if (params.explicit !== undefined) {
    return params.explicit == null ? null : Number(params.explicit);
  }
  if ((params.method ?? ShippingMethod.manual) !== ShippingMethod.carrier) {
    return undefined;
  }
  return calculateOrderVolume(params.lines, params.volumeByProductId);
}
