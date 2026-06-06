/** Exponential backoff delay in milliseconds for drive upload retries. */
export function computeDriveRetryDelayMs(
  attempt: number,
  baseSec: number,
  maxSec: number,
): number {
  const baseMs = Math.max(1, baseSec) * 1000;
  const maxMs = Math.max(baseMs, maxSec * 1000);
  const exponent = Math.max(0, attempt - 1);
  const delay = baseMs * 2 ** exponent;
  return Math.min(maxMs, delay);
}
