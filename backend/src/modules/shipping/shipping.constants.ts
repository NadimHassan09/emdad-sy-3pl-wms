/** Canonical Babel Express provider code (no Nest DI — safe for circular-free imports). */
export const BABEL_EXPRESS_CODE = 'BABEL_EXPRESS';

/** Pseudo-provider for Manual shipping in bulk selection (not a registry adapter). */
export const MANUAL_SHIPPING_CODE = 'MANUAL';

/** Controlled concurrency for bulk carrier API calls. */
export const BULK_SHIPPING_CONCURRENCY = 2;
