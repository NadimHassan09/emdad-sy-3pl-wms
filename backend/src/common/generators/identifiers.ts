import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Format: SKU-{6 unambiguous chars}-{base36 ms timestamp suffix}.
 * Always uppercase. Globally unique with very high probability; the
 * persistence layer must still retry on the (companyId, sku) unique index.
 */
export function generateSkuCandidate(): string {
  const random = randomToken(6);
  const ts = Date.now().toString(36).toUpperCase();
  return `SKU-${random}-${ts}`;
}

/**
 * Distinct from SKU shape — used as default `products.barcode` on create when the client omits one.
 */
export function generateBarcodeCandidate(): string {
  const random = randomToken(8);
  const ts = Date.now().toString(36).toUpperCase();
  return `BCN-${random}-${ts}`;
}

/**
 * Format: LOT-YYYYMMDD-XXXX (4-char unambiguous random suffix).
 */
export function generateLotCandidate(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = now.getUTCDate().toString().padStart(2, '0');
  return `LOT-${yyyy}${mm}${dd}-${randomToken(4)}`;
}

/**
 * Slugify a free-text fragment so it can be safely embedded inside a barcode:
 * uppercase, ASCII letters / digits / dash only, collapses whitespace to '-',
 * strips other punctuation.
 */
export function slugifyForBarcode(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
