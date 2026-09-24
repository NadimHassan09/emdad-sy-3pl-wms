export type ShippingCredentials = {
  username: string;
  password: string;
};

export type ShippingTestResult = {
  ok: boolean;
  message?: string;
};

export type ShippingCreateShipmentInput = {
  reference?: string;
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
  /** Opaque routing token from getQuote/getServiceOptions. Provider-specific (e.g. "SILA_SY:{courier_id}"). */
  serviceId?: string;
};

export type ShippingCreateShipmentResult = {
  awb: string;
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
  /** Passed through for adapters that price by volume; ignored when the carrier API has no field. */
  volumeCbm?: number;
  governorate?: string;
  city?: string;
  neighborhood?: string;
  codAmount?: number;
  currency?: string;
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
  carrierReturnStage?: 'return_created' | 'returning_to_sender' | 'returned_to_sender';
  rawPayload: unknown;
};

export type UnifiedShipmentMovementEvent = {
  timestamp: string; // ISO 8601
  title: string;
  location?: string | null;
  notes?: string | null;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  code?: string | null;
};

export type ShipmentTrackingResult = {
  providerCode: string;
  providerName: string;
  awb: string;
  isDelivered?: boolean;
  statusLabel?: string;
  statusColor?: string;
  events: UnifiedShipmentMovementEvent[];
  message?: string;
  error?: string;
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
   * Register or update webhook endpoint with the carrier API if supported.
   */
  registerWebhook?(
    credentials: ShippingCredentials,
    webhookUrl: string,
    secret: string,
  ): Promise<{ ok: boolean; message?: string }>;
}
