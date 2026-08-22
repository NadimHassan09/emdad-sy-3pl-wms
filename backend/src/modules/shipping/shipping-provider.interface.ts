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
};

/** How the carrier delivers printable labels to WMS (do not invent labels). */
export type ShippingLabelDelivery = 'api' | 'carrier_provided' | 'none';

export type ShippingProviderCapabilities = {
  supportsQuote: boolean;
  supportsLabelPrinting: boolean;
  labelDelivery: ShippingLabelDelivery;
};

export type ShippingLabelResult = {
  /** Direct printable URL from carrier, if any. */
  url?: string;
  /** Base64 PDF from carrier, if any. */
  pdfBase64?: string;
  contentType?: string;
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
   * Optional. Only implement when the carrier API truly returns a printable label.
   * Return null when unavailable — never fabricate a label.
   */
  getLabel?(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShippingLabelResult | null>;
}
