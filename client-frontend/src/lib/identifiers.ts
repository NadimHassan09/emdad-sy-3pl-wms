const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[arr[i]! % ALPHABET.length];
  }
  return out;
}

export function generateSku(): string {
  return `SKU-${randomToken(6)}-${Date.now().toString(36).toUpperCase()}`;
}

/** Mirrors backend `generateBarcodeCandidate` for instant UI feedback before create. */
export function generateBarcode(): string {
  return `BCN-${randomToken(8)}-${Date.now().toString(36).toUpperCase()}`;
}
