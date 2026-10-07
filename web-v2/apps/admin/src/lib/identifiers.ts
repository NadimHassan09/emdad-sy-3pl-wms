/**
 * Browser-side identifier generators that mirror the backend formats so
 * the user sees an instant result when they click "Generate". The backend
 * still validates uniqueness and re-generates if missing/conflicting.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return out;
}

export function generateSku(): string {
  return `SKU-${randomToken(6)}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateLotNumber(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = now.getUTCDate().toString().padStart(2, '0');
  return `LOT-${yyyy}${mm}${dd}-${randomToken(4)}`;
}
