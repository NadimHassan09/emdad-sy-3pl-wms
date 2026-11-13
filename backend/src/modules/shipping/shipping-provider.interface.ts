export type ShippingCredentials = {
  username: string;
  password: string;
};

export type ShippingTestResult = {
  ok: boolean;
  message?: string;
};

/** Where the carrier collects the parcel. Independent of delivery (home vs hub). */
export type ShippingParty = {
  name: string;
  phoneCountry: string;
  phoneLocal: string;
  address: string;
  lat?: number;
  lng?: number;
  neighbourhoodId?: number;
  governorate?: string;
  city?: string;
  neighborhood?: string;
};

export type ShippingCreateShipmentInput = {
  reference?: string;
  /** Courier pickup location. Required when pickupType is address. */
  pickup?: ShippingParty;
  receiver: {
    name: string;
    phoneCountry: string;
    phoneLocal: string;
    address: string;
    lat: number;
    lng: number;
    /** Babel neighbourhood id — preferred identity for quote and create. */
    neighbourhoodId?: number;
    governorate?: string;
    city?: string;
    neighborhood?: string;
  };
  packageType: 'box' | 'envelope';
  /** Aggregate weight (legacy / envelope); prefer `parts` when multi-unit. */
  weightKg: number;
  /** One Babel part per physical unit (weight kg only per OpenAPI). */
  parts?: Array<{ weight: number }>;
  contents: string;
  deliveryType: 'address' | 'hub';
  pickupType: 'address' | 'hub';
  payer: 'sender' | 'receiver' | 'reseller';
  codAmount: number;
  currency?: string;
  /**
   * Carrier shipping quote in the same currency as `codAmount` when known.
   * Sila: when payer is receiver and COD > 0, the API rejects non-zero COD with
   * shipping_paid_by=receiver — fold this fee into pay_on_delivery and use merchant.
   */
  carrierShippingFee?: number | null;
  /** Opaque routing token from getQuote/getServiceOptions. Provider-specific (e.g. "SILA_SY:{courier_id}"). */
  serviceId?: string;
  /** Provider hub/branch id for Hub Delivery. Ignored for home delivery. */
  hubId?: string;
  /** Physical items in shipment when available from OMS/WMS order lines. */
  items?: Array<{
    name?: string;
    sku?: string;
    barcode?: string;
    product_id?: number;
    quantity: number;
    price?: number;
    weight?: number;
  }>;
};

export type ShippingCreateShipmentResult = {
  /** Provider/platform identifier (e.g. Sila barcode). */
  awb: string;
  /**
   * Courier-facing tracking when distinct from `awb`.
   * When omitted, callers may fall back to `awb`.
   */
  trackingNumber?: string;
  /** Package part barcodes when returned by multi-part carriers (e.g. Babel Express). */
  partBarcodes?: string[];
  raw?: unknown;
};

export type ShippingQuoteInput = {
  receiverLat: number;
  receiverLng: number;
  /** Prefer Babel neighbourhood id so quote and createShipment share identity. */
  neighbourhoodId?: number;
  packageType: 'box' | 'envelope';
  weightKg: number;
  parts?: Array<{ weight: number }>;
  deliveryType: 'address' | 'hub';
  pickupType?: 'address' | 'hub';
  /** Pickup neighbourhood/address used to price address pickup (Babel sender). */
  pickup?: ShippingParty;
  /** Passed through for adapters that price by volume; ignored when the carrier API has no field. */
  volumeCbm?: number;
  governorate?: string;
  city?: string;
  neighborhood?: string;
  codAmount?: number;
  currency?: string;
  /** Provider hub/branch id when requoting a Hub Delivery selection. */
  hubId?: string;
};

export type ShippingHubOption = {
  id: string;
  name: string;
  nearest?: boolean;
};

export type ShippingQuoteResult = {
  price: number;
  currency: string;
  /** Optional multi-currency amounts from the provider API. */
  prices?: Array<{ price: number; currency: string }>;
  details?: unknown;
  /** When the carrier adjusts delivery mode (e.g. address unavailable → hub). */
  effectiveDeliveryType?: 'address' | 'hub';
  /** False when Babel returned a non-shippable calculatePrice shape. */
  shippable?: boolean;
  /** Business days, only when the carrier API returns them. Never invent. */
  estimatedDeliveryMin?: number;
  estimatedDeliveryMax?: number;
  serviceId?: string;
  serviceName?: string;
  restrictions?: string[];
  /** Babel neighbourhood id used for this quote (when known). */
  neighbourhoodId?: number;
  /** Display name of provider or aggregator (e.g. "Sila-SY.com", "Babel Express"). */
  providerName?: string;
  /** Logo image URL if returned by carrier API. */
  logoUrl?: string;
  /** Hubs/branches for Hub Delivery. Omitted when the carrier has no selectable hubs. */
  hubs?: ShippingHubOption[];
  nearestHubId?: string | null;
  nearestHubDetermined?: boolean;
};

/** How the carrier delivers printable labels to WMS (do not invent labels). */
export type ShippingLabelDelivery = 'api' | 'carrier_provided' | 'none';

export type ShippingProviderCapabilities = {
  supportsQuote: boolean;
  supportsLabelPrinting: boolean;
  labelDelivery: ShippingLabelDelivery;
  supportsTracking?: boolean;
  supportsWebhooks?: boolean;
};

export type ShippingLabelResult = {
  /** Direct printable URL from carrier, if any. */
  url?: string;
  /** Base64 PDF from carrier, if any. */
  pdfBase64?: string;
  contentType?: string;
};

export type NormalizedTrackingStatus =
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'return_created'
  | 'returning_to_sender'
  | 'returned_to_sender'
  | 'returned'
  | 'cancelled'
  | 'unknown';

export type NormalizedTrackingEvent = {
  providerCode: string;
  externalEventId?: string;
  awb: string;
  eventType: string;
  normalizedStatus: NormalizedTrackingStatus;
  timestamp?: Date;
  locationText?: string;
  notes?: string;
  returnReason?: string;
  originalCarrierStatus?: string;
  /** Carrier-provided status or event description in original language (e.g. Arabic) */
  eventDescription?: string;
  carrierReturnStage?: 'return_created' | 'returning_to_sender' | 'returned_to_sender';
  /** webhook: provider pushed the event. poll: OMS fetched cargo/tracking. */
  costSource?: 'webhook' | 'poll';
  sourceType?: 'webhook' | 'poll' | 'carrier_timeline' | 'manual';
  isCarrierEvent?: boolean;
  /** Sila X-Sila-Delivery header — retry dedup, distinct from dual terminal events. */
  deliveryId?: string;
  /** Merchant reference (Emdad order number) when the provider sends it. */
  reference?: string;
  rawPayload: unknown;
};

export type UnifiedShipmentMovementEvent = {
  timestamp: string; // ISO 8601
  title: string;
  location?: string | null;
  notes?: string | null;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  code?: string | null;
  /** Carrier-originated vs Emdad internal event */
  source?: 'carrier' | 'emdad';
  /** Raw carrier description if different from display title */
  originalDescription?: string | null;
};

export type ShipmentTrackingResult = {
  providerCode: string;
  providerName: string;
  awb: string;
  awbPending?: boolean;
  isDelivered?: boolean;
  statusLabel?: string;
  statusColor?: string;
  events: UnifiedShipmentMovementEvent[];
  message?: string;
  error?: string;
  /** Live cargo/tracking snapshot used internally to persist identity. Never returned to clients. */
  rawPayload?: unknown;
  /** Provider lookup classification. `not_found` is not confirmed cancellation. */
  lookupState?: 'ok' | 'not_found' | 'error';
  /** Local shipment activity. Cancelled/superseded rows are historical. */
  shipmentState?: 'active' | 'cancelled' | 'superseded';
  /** True when the provider could not find the AWB and cancellation is unconfirmed. */
  cancellationUnconfirmed?: boolean;
};

export interface ShippingProvider {
  readonly code: string;
  readonly capabilities: ShippingProviderCapabilities;
  testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult>;
  createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult>;
  getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult>;
  /**
   * Optional: return ALL service options independently.
   * Aggregator providers (e.g. Sila-SY) implement this to expose every sub-carrier.
   * The service layer — not the adapter — decides what to surface.
   * Babel implements this too (address + hub options).
   */
  getServiceOptions?(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]>;
  /**
   * Optional. Only implement when the carrier API truly returns a printable label.
   * Return null when unavailable — never fabricate a label.
   */
  getLabel?(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShippingLabelResult | null>;

  /**
   * Normalize an incoming webhook payload into a canonical tracking event.
   * Return null if the webhook is not a tracking event (e.g. handshake/ping).
   */
  normalizeWebhook?(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null;

  /**
   * Verify authenticity of an incoming webhook using signature or secret.
   */
  verifyWebhook?(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    secret?: string,
  ): boolean;

  /**
   * Query the carrier API directly for the current tracking status of an AWB.
   */
  pollTracking?(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<NormalizedTrackingEvent | null>;

  /**
   * Fetch full shipment movement history from the carrier API if supported.
   */
  getTrackingHistory?(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null>;

  /**
   * Lookup an existing shipment by our reference. Implement only when the carrier
   * already exposes it. Do not invent an endpoint.
   */
  findShipmentByReference?(
    credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string } | null>;

  /**
   * Register or update webhook endpoint with the carrier API if supported.
   */
  registerWebhook?(
    credentials: ShippingCredentials,
    webhookUrl: string,
    secret: string,
  ): Promise<{ ok: boolean; message?: string; secret?: string; webhookId?: string }>;

  /** Official provider test ping after the signing secret is stored. */
  testRegisteredWebhook?(
    credentials: ShippingCredentials,
    webhookId: string,
  ): Promise<{ ok: boolean; message?: string }>;

  /**
   * Ask the provider to cancel a cargo. Optional — Babel has no cancel API.
   * Callers must not treat pending confirmation as a completed OMS cancel.
   */
  cancelShipment?(
    credentials: ShippingCredentials,
    providerId: string,
  ): Promise<ShippingCancelResult>;
}

export type ShippingCancelResult = {
  outcome: 'cancelled' | 'pending_confirmation' | 'already_cancelled' | 'refused' | 'retry';
  courierCancel?: string;
  message: string;
  retryAfterSeconds?: number;
  errorCode?: string;
  cargoStatus?: string;
  raw?: unknown;
};
