/** Query / JSON helper: treat absent values as undefined, normalize common booleans. */
export function coerceOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return undefined;
}
