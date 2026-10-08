/** Canonical Babel Express provider code (no Nest DI — safe for circular-free imports). */
export const BABEL_EXPRESS_CODE = 'BABEL_EXPRESS';

/** Canonical Sila-SY provider code. */
export const SILA_SY_CODE = 'SILA_SY';


/** Pseudo-provider for Manual shipping in bulk selection (not a registry adapter). */
export const MANUAL_SHIPPING_CODE = 'MANUAL';

/** Controlled concurrency for bulk carrier API calls (legacy global pool). */
export const BULK_SHIPPING_CONCURRENCY = 2;

/** Per-platform concurrency for OMS Send Shipment (provider-aware). */
export const SEND_CONCURRENCY_BY_PROVIDER: Record<string, number> = {
  BABEL_EXPRESS: 2,
  SILA_SY: 3,
};

export const SEND_CONCURRENCY_DEFAULT = 2;
