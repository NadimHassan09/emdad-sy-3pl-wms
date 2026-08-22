/** Count non-empty applied filter values (empty string / null / undefined ignored). */
export function countNonEmptyFilters(
  source: Record<string, unknown> | null | undefined,
  keys?: string[],
): number {
  if (!source) return 0;
  const entries = keys ? keys.map((k) => [k, source[k]] as const) : Object.entries(source);
  let n = 0;
  for (const [, value] of entries) {
    if (value == null) continue;
    if (typeof value === 'boolean') {
      if (value) n += 1;
      continue;
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) n += 1;
      continue;
    }
    if (String(value).trim()) n += 1;
  }
  return n;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/**
 * Merge a cached / partial filter object onto defaults so missing keys
 * from older list-cache entries do not crash `.trim()`.
 */
export function normalizeFilters<T extends Record<string, unknown>>(
  raw: Partial<T> | null | undefined,
  defaults: T,
): T {
  const src = (raw ?? {}) as Record<string, unknown>;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const fallback = defaults[key];
    const incoming = src[key as string];
    if (incoming === undefined) continue;
    if (typeof fallback === 'string') {
      (next as Record<string, unknown>)[key as string] = text(incoming);
    } else if (typeof fallback === 'boolean') {
      (next as Record<string, unknown>)[key as string] = Boolean(incoming);
    } else {
      (next as Record<string, unknown>)[key as string] = incoming;
    }
  }
  return next;
}

/** Join applied filter labels for a collapsed summary line. */
export function joinFilterSummary(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return cleaned.length > 0 ? cleaned.join(' · ') : null;
}
