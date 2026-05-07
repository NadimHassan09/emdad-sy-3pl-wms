import { Transform } from 'class-transformer';

/** Query params often arrive as `''`; `@IsOptional()` only skips null/undefined. */
export function EmptyToUndefined() {
  return Transform(({ value }) =>
    value === '' || value === undefined || value === null ? undefined : value,
  );
}

/** Parses `true`/`false`/1/0/`1`/`0`/`''`→undefined from query strings. */
export function QueryBoolOptional() {
  return Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    if (value === false || value === 'false' || value === '0' || value === 0) return false;
    return undefined;
  });
}

function coercePageInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function PaginationLimit(defaultVal = 50, maxVal = 500) {
  return Transform(({ value }) => {
    const n = coercePageInt(value, defaultVal);
    return Math.min(Math.max(n, 1), maxVal);
  });
}

export function PaginationOffset(defaultVal = 0) {
  return Transform(({ value }) => {
    const n = coercePageInt(value, defaultVal);
    return n < 0 ? defaultVal : n;
  });
}
