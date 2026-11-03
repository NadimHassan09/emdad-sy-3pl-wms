/**
 * The order search box accepts several terms (one per line, or separated by commas or semicolons),
 * so a list of scanned waybills can be shown together. An order matches when any term matches.
 */
export const MAX_ORDER_SEARCH_TERMS = 100;

export function splitOrderSearchTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const part of raw.split(/[\n\r,;]+/)) {
    const t = part.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    terms.push(t);
    if (terms.length >= MAX_ORDER_SEARCH_TERMS) break;
  }
  return terms;
}
