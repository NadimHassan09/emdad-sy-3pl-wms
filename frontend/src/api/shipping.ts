import { api } from './client';

export type ShippingMethod = 'manual' | 'carrier';
export type ShippingPackageType = 'box' | 'envelope';
export type ShippingDeliveryType = 'address' | 'hub';
export type ShippingPickupType = 'address' | 'hub';
export type ShippingPayer = 'sender' | 'receiver' | 'reseller';
export type CarrierShipmentStatus = 'pending' | 'created' | 'failed';

export type ShippingProviderAdminView = {
  code: string;
  name: string;
  enabled: boolean;
  status: 'disconnected' | 'connected';
  connected: boolean;
  usernameMasked: string | null;
  connectedBy: { id: string; email: string; fullName: string } | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastErrorSafe: string | null;
};

export type ConnectShippingProviderInput = {
  username: string;
  password: string;
};

export type ShippingProviderTestResult = {
  ok: boolean;
  message?: string;
};

export type ShippingDestinationArea = {
  governorate?: string;
  city?: string;
  neighborhood?: string;
};

export type ShippingAreaBoundary = {
  found?: boolean;
  query?: string;
  displayName?: string;
  geometry: { type: string; coordinates: unknown } | null;
  bbox?: { south: number; north: number; west: number; east: number } | null;
  source?: 'nominatim' | null;
};

export type BabelGeoCity = { id: number; name: string; syncedAt?: string };
export type BabelGeoArea = { id: number; cityId: number; name: string; syncedAt?: string };
export type BabelGeoNeighbourhood = {
  id: number;
  areaId: number;
  name: string;
  syncedAt?: string;
};

export type ShippingRatePrice = {
  price: number;
  currency: string;
};

export type ShippingRateQuote = {
  carrierId: string;
  carrierName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  price: number;
  currency: string;
  /**
   * When the provider API returns multiple currencies, list them here.
   * UI shows USD first, then SYP. If omitted, `price` + `currency` are used.
   */
  prices?: ShippingRatePrice[];
  estimatedDeliveryMin?: number;
  estimatedDeliveryMax?: number;
  deliveryType?: string;
  restrictions?: string[];
  isCheapest?: boolean;
  isFastest?: boolean;
  isRecommended?: boolean;
};

export type ShippingRateError = {
  carrierId: string;
  carrierName: string;
  message: string;
};

export type QuoteShippingRatesInput = {
  receiverLat?: number;
  receiverLng?: number;
  neighbourhoodId?: number | null;
  packageType: ShippingPackageType;
  weightKg: number;
  deliveryType: ShippingDeliveryType;
  pickupType?: ShippingPickupType;
  volumeCbm?: number | null;
  codAmount?: number | null;
  governorate?: string;
  city?: string;
  neighborhood?: string;
  /** One entry per carton — Babel part weight (kg). */
  parts?: Array<{ weight: number }>;
};

export type QuoteShippingRatesResult = {
  inSelectedArea: boolean | null;
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
};

export type CarrierShipment = {
  id: string;
  outboundOrderId: string;
  providerId: string;
  providerCode: string;
  externalAwb: string | null;
  trackingNumber: string | null;
  status: CarrierShipmentStatus;
  shippingCost?: string | number | null;
  currency?: string | null;
  lastErrorSafe: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Shared shipping config payload for OMS / Outbound create & update. */
export type ShippingConfigPayload = {
  shippingMethod?: ShippingMethod;
  shippingProviderCode?: string | null;
  shippingReceiverLat?: number | null;
  shippingReceiverLng?: number | null;
  shippingPackageType?: ShippingPackageType | null;
  shippingContents?: string | null;
  shippingDeliveryType?: ShippingDeliveryType | null;
  shippingPickupType?: ShippingPickupType | null;
  shippingPayer?: ShippingPayer | null;
  shippingWeightKg?: number | null;
  shippingVolumeCbm?: number | null;
  shippingPackages?: Array<{
    lines: Array<{ productId: string; quantity: number }>;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  }> | null;
  shippingPhoneCountry?: string | null;
  babelNeighbourhoodId?: number | null;
};

/** Form-friendly shipping field state (string inputs). */
export type OrderShippingFieldsValue = {
  shippingMethod: ShippingMethod;
  shippingProviderCode: string;
  shippingReceiverLat: string;
  shippingReceiverLng: string;
  shippingPackageType: ShippingPackageType | '';
  shippingContents: string;
  shippingDeliveryType: ShippingDeliveryType | '';
  shippingPickupType: ShippingPickupType | '';
  shippingPayer: ShippingPayer | '';
  shippingWeightKg: string;
  shippingVolumeCbm: string;
  shippingPhoneCountry: string;
  babelNeighbourhoodId: string;
};

export function emptyOrderShippingFields(): OrderShippingFieldsValue {
  return {
    shippingMethod: 'manual',
    shippingProviderCode: '',
    shippingReceiverLat: '',
    shippingReceiverLng: '',
    shippingPackageType: '',
    shippingContents: '',
    shippingDeliveryType: '',
    shippingPickupType: '',
    shippingPayer: '',
    shippingWeightKg: '',
    shippingVolumeCbm: '',
    shippingPhoneCountry: '',
    babelNeighbourhoodId: '',
  };
}

function numOrEmpty(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  return String(v);
}

export function orderShippingFieldsFromApi(
  src: Partial<ShippingConfigPayload> | null | undefined,
): OrderShippingFieldsValue {
  const base = emptyOrderShippingFields();
  if (!src) return base;
  return {
    shippingMethod: src.shippingMethod === 'carrier' ? 'carrier' : 'manual',
    shippingProviderCode: src.shippingProviderCode?.trim() ?? '',
    shippingReceiverLat: numOrEmpty(src.shippingReceiverLat),
    shippingReceiverLng: numOrEmpty(src.shippingReceiverLng),
    shippingPackageType: (src.shippingPackageType as ShippingPackageType | null) ?? '',
    shippingContents: src.shippingContents?.trim() ?? '',
    shippingDeliveryType: (src.shippingDeliveryType as ShippingDeliveryType | null) ?? '',
    shippingPickupType: (src.shippingPickupType as ShippingPickupType | null) ?? '',
    shippingPayer: (src.shippingPayer as ShippingPayer | null) ?? '',
    shippingWeightKg: numOrEmpty(src.shippingWeightKg),
    shippingVolumeCbm: numOrEmpty(src.shippingVolumeCbm),
    shippingPhoneCountry: src.shippingPhoneCountry?.trim() ?? '',
    babelNeighbourhoodId: numOrEmpty(src.babelNeighbourhoodId),
  };
}

function parseOptionalNumber(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/** Build API payload. Manual method clears carrier-only fields. */
export function orderShippingFieldsToPayload(
  value: OrderShippingFieldsValue,
): ShippingConfigPayload {
  if (value.shippingMethod !== 'carrier') {
    return { shippingMethod: 'manual' };
  }
  return {
    shippingMethod: 'carrier',
    shippingProviderCode: value.shippingProviderCode.trim() || null,
    shippingReceiverLat: parseOptionalNumber(value.shippingReceiverLat) ?? null,
    shippingReceiverLng: parseOptionalNumber(value.shippingReceiverLng) ?? null,
    shippingPackageType: value.shippingPackageType || null,
    shippingContents: value.shippingContents.trim() || null,
    shippingDeliveryType: value.shippingDeliveryType || null,
    shippingPickupType: value.shippingPickupType || null,
    shippingPayer: value.shippingPayer || null,
    shippingWeightKg: parseOptionalNumber(value.shippingWeightKg) ?? null,
    shippingVolumeCbm: parseOptionalNumber(value.shippingVolumeCbm) ?? null,
    shippingPhoneCountry: value.shippingPhoneCountry.trim() || null,
    babelNeighbourhoodId: parseOptionalNumber(value.babelNeighbourhoodId) ?? null,
  };
}

/** Intent-only payload for OMS / early outbound (method + provider). */
export function orderShippingIntentToPayload(
  value: Pick<OrderShippingFieldsValue, 'shippingMethod' | 'shippingProviderCode'>,
): ShippingConfigPayload {
  if (value.shippingMethod !== 'carrier') {
    return { shippingMethod: 'manual' };
  }
  return {
    shippingMethod: 'carrier',
    shippingProviderCode: value.shippingProviderCode.trim() || null,
  };
}

/** Full details payload for Shipping Details Save, including method/provider. */
export function orderShippingDetailsToPayload(
  value: OrderShippingFieldsValue,
): ShippingConfigPayload {
  return {
    shippingMethod: value.shippingMethod,
    shippingProviderCode:
      value.shippingMethod === 'carrier' ? value.shippingProviderCode.trim() || null : null,
    shippingReceiverLat: parseOptionalNumber(value.shippingReceiverLat) ?? null,
    shippingReceiverLng: parseOptionalNumber(value.shippingReceiverLng) ?? null,
    shippingPackageType: value.shippingPackageType || null,
    shippingContents: value.shippingContents.trim() || null,
    shippingDeliveryType: value.shippingDeliveryType || null,
    shippingPickupType: value.shippingPickupType || null,
    shippingPayer: value.shippingPayer || null,
    shippingWeightKg: parseOptionalNumber(value.shippingWeightKg) ?? null,
    shippingVolumeCbm: parseOptionalNumber(value.shippingVolumeCbm) ?? null,
    shippingPhoneCountry: value.shippingPhoneCountry.trim() || null,
    babelNeighbourhoodId: parseOptionalNumber(value.babelNeighbourhoodId) ?? null,
  };
}

/** Authoritative order weight: Σ(unitWeight × quantity). */
export function calculateOrderWeight(
  lines: Array<{ productId: string; requestedQuantity: string | number }>,
  weightByProductId: Map<string, number | string | null | undefined> | Iterable<{
    id: string;
    weightKg?: number | string | null;
  }>,
): number | null {
  return computeSuggestedWeightKg(lines, weightByProductId);
}

/** Sum product.weightKg × qty; null if no usable weights. */
export function computeSuggestedWeightKg(
  lines: Array<{ productId: string; requestedQuantity: string | number }>,
  weightByProductId: Map<string, number | string | null | undefined> | Iterable<{
    id: string;
    weightKg?: number | string | null;
  }>,
): number | null {
  const map =
    weightByProductId instanceof Map
      ? weightByProductId
      : new Map(
          Array.from(weightByProductId).map((p) => [p.id, p.weightKg] as const),
        );
  let sum = 0;
  let any = false;
  for (const line of lines) {
    if (!line.productId) continue;
    const w = map.get(line.productId);
    if (w == null || w === '') continue;
    const weight = Number(w);
    const qty = Number(line.requestedQuantity);
    if (!Number.isFinite(weight) || !Number.isFinite(qty) || weight < 0 || qty <= 0) continue;
    any = true;
    sum += weight * qty;
  }
  return any ? Math.round(sum * 10000) / 10000 : null;
}

/** Authoritative order volume: Σ(unitVolume × quantity). */
export function calculateOrderVolume(
  lines: Array<{ productId: string; requestedQuantity: string | number }>,
  volumeByProductId: Map<string, number | string | null | undefined> | Iterable<{
    id: string;
    volumeCbm?: number | string | null;
  }>,
): number | null {
  return computeSuggestedVolumeCbm(lines, volumeByProductId);
}

/** Sum product.volumeCbm × qty; null if no usable volumes. */
export function computeSuggestedVolumeCbm(
  lines: Array<{ productId: string; requestedQuantity: string | number }>,
  volumeByProductId: Map<string, number | string | null | undefined> | Iterable<{
    id: string;
    volumeCbm?: number | string | null;
  }>,
): number | null {
  const map =
    volumeByProductId instanceof Map
      ? volumeByProductId
      : new Map(
          Array.from(volumeByProductId).map((p) => [p.id, p.volumeCbm] as const),
        );
  let sum = 0;
  let any = false;
  for (const line of lines) {
    if (!line.productId) continue;
    const v = map.get(line.productId);
    if (v == null || v === '') continue;
    const volume = Number(v);
    const qty = Number(line.requestedQuantity);
    if (!Number.isFinite(volume) || !Number.isFinite(qty) || volume < 0 || qty <= 0) continue;
    any = true;
    sum += volume * qty;
  }
  return any ? Math.round(sum * 1_000_000) / 1_000_000 : null;
}

export const SHIPPING_LOCKED_OUTBOUND_STATUSES = new Set([
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
]);

export function isShippingConfigLocked(outboundStatus: string | null | undefined): boolean {
  if (!outboundStatus) return false;
  return SHIPPING_LOCKED_OUTBOUND_STATUSES.has(outboundStatus);
}

export const ShippingApi = {
  listProviders(): Promise<ShippingProviderAdminView[]> {
    return api.get<ShippingProviderAdminView[]>('/shipping/providers').then((r) => r.data);
  },

  connectProvider(
    code: string,
    body: ConnectShippingProviderInput,
  ): Promise<ShippingProviderAdminView> {
    return api
      .post<ShippingProviderAdminView>(`/shipping/providers/${encodeURIComponent(code)}/connect`, body)
      .then((r) => r.data);
  },

  testProvider(code: string): Promise<ShippingProviderTestResult> {
    return api
      .post<ShippingProviderTestResult>(`/shipping/providers/${encodeURIComponent(code)}/test`)
      .then((r) => r.data);
  },

  disconnectProvider(code: string): Promise<ShippingProviderAdminView> {
    return api
      .post<ShippingProviderAdminView>(
        `/shipping/providers/${encodeURIComponent(code)}/disconnect`,
      )
      .then((r) => r.data);
  },

  retryShipment(outboundOrderId: string): Promise<{ ok: boolean }> {
    return api
      .post<{ ok: boolean }>(
        `/shipping/shipments/${encodeURIComponent(outboundOrderId)}/retry`,
      )
      .then((r) => r.data);
  },

  getAreaBoundary(params: {
    governorate?: string;
    city?: string;
    neighborhood?: string;
  }): Promise<ShippingAreaBoundary> {
    const qs = new URLSearchParams();
    if (params.governorate?.trim()) qs.set('governorate', params.governorate.trim());
    if (params.city?.trim()) qs.set('city', params.city.trim());
    if (params.neighborhood?.trim()) qs.set('neighborhood', params.neighborhood.trim());
    return api
      .get<ShippingAreaBoundary>(`/shipping/geo/boundary?${qs.toString()}`)
      .then((r) => r.data);
  },

  listBabelCities(): Promise<BabelGeoCity[]> {
    return api.get<BabelGeoCity[]>('/shipping/babel/geo/cities').then((r) => r.data);
  },

  listBabelAreas(cityId: number): Promise<BabelGeoArea[]> {
    return api
      .get<BabelGeoArea[]>(`/shipping/babel/geo/cities/${cityId}/areas`)
      .then((r) => r.data);
  },

  listBabelNeighbourhoods(areaId: number): Promise<BabelGeoNeighbourhood[]> {
    return api
      .get<BabelGeoNeighbourhood[]>(`/shipping/babel/geo/areas/${areaId}/neighbourhoods`)
      .then((r) => r.data);
  },

  resolveAddressFromPin(
    lat: number,
    lng: number,
  ): Promise<
    | {
        found: true;
        governorate: string;
        cityRegion: string;
        townNeighborhood: string;
        lat: number;
        lng: number;
        distanceMeters: number;
      }
    | {
        found: false;
        message: string;
        nearestLabel?: string;
        distanceMeters?: number;
      }
  > {
    return api
      .post('/shipping/address/resolve-from-pin', { lat, lng })
      .then((r) => r.data);
  },

  resolveAddressFromNames(
    input: {
      governorate: string;
      cityRegion: string;
      townNeighborhood: string;
    },
    signal?: AbortSignal,
  ): Promise<
    | {
        found: true;
        lat: number;
        lng: number;
        source: 'neighborhood' | 'city' | 'governorate';
        resolvedLabel: string;
      }
    | { found: false; message: string }
  > {
    return api
      .post('/shipping/address/resolve-from-names', input, { signal })
      .then((r) => r.data);
  },

  quoteRates(body: QuoteShippingRatesInput, signal?: AbortSignal): Promise<QuoteShippingRatesResult> {
    return api.post<QuoteShippingRatesResult>('/shipping/rates', body, { signal }).then((r) => r.data);
  },

  bulkPreview(outboundOrderIds: string[]): Promise<BulkShippingPreviewResult> {
    return api
      .post<BulkShippingPreviewResult>('/shipping/bulk/preview', { outboundOrderIds })
      .then((r) => r.data);
  },

  bulkConfirm(
    items: BulkShippingConfirmItem[],
  ): Promise<BulkShippingJobView> {
    return api
      .post<BulkShippingJobView>('/shipping/bulk/jobs', { items })
      .then((r) => r.data);
  },

  bulkGetJob(jobId: string): Promise<BulkShippingJobView> {
    return api
      .get<BulkShippingJobView>(`/shipping/bulk/jobs/${encodeURIComponent(jobId)}`)
      .then((r) => r.data);
  },

  bulkRetryItem(jobId: string, outboundOrderId: string): Promise<BulkShippingJobView> {
    return api
      .post<BulkShippingJobView>(
        `/shipping/bulk/jobs/${encodeURIComponent(jobId)}/items/${encodeURIComponent(outboundOrderId)}/retry`,
      )
      .then((r) => r.data);
  },

  bulkGetLabels(jobId: string): Promise<BulkShippingLabelsResult> {
    return api
      .get<BulkShippingLabelsResult>(
        `/shipping/bulk/jobs/${encodeURIComponent(jobId)}/labels`,
      )
      .then((r) => r.data);
  },
};

export type BulkShippingPreviewLine = {
  outboundOrderId: string;
  orderNumber: string;
  omsOrderNumber: string | null;
  companyId: string;
  companyName: string | null;
  weightKg: number | null;
  volumeCbm: number | null;
  currentMethod: ShippingMethod;
  currentProviderCode: string | null;
  quotes: Array<{
    providerCode: string;
    providerName: string;
    price: number;
    currency: string;
  }>;
  recommendedProviderCode: string | null;
  recommendedPrice: number | null;
  recommendedCurrency: string | null;
  selectedProviderCode: string;
  recommendationNote: string | null;
  labelDeliveryHint: string;
};

export type BulkShippingSelectableProvider = {
  code: string;
  name: string;
  supportsQuote: boolean;
  supportsLabelPrinting: boolean;
  labelDelivery: string;
  connected: boolean;
};

export type BulkShippingPreviewResult = {
  lines: BulkShippingPreviewLine[];
  estimatedTotalCost: number | null;
  estimatedCurrency: string | null;
  selectableProviders: BulkShippingSelectableProvider[];
};

export type BulkShippingConfirmItem = {
  outboundOrderId: string;
  providerCode: string;
  quotedPrice?: number | null;
  quotedCurrency?: string | null;
  recommendedProviderCode?: string | null;
};

export type BulkShippingJobItemView = {
  id: string;
  outboundOrderId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'skipped' | 'failed';
  selectedProviderCode: string;
  recommendedProviderCode: string | null;
  quotedPrice: string | null;
  quotedCurrency: string | null;
  externalAwb: string | null;
  labelCapability: string | null;
  lastErrorSafe: string | null;
  processedAt: string | null;
  orderNumber: string | null;
  omsOrderNumber: string | null;
  companyName: string | null;
  outboundStatus: string | null;
};

export type BulkShippingJobView = {
  id: string;
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'cancelled';
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  progressPercent: number;
  estimatedTotalCost: string | null;
  estimatedCurrency: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: BulkShippingJobItemView[];
};

export type BulkShippingLabelsResult = {
  jobId: string;
  labels: Array<{
    outboundOrderId: string;
    orderNumber: string;
    awb: string | null;
    providerCode: string;
    labelDelivery: string;
    url?: string;
    pdfBase64?: string;
    message: string;
  }>;
};
