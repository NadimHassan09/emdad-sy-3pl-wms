/** Minimum visible rows in GRN/DN item tables (pad with blanks when fewer lines). */
export const DOCUMENT_TABLE_MIN_ROWS = 5;

/** Placeholder slots for empty table rows in Handlebars templates. */
export function emptyTableRowSlots(itemCount: number, minRows = DOCUMENT_TABLE_MIN_ROWS): number[] {
  const n = Math.max(0, minRows - itemCount);
  return Array.from({ length: n }, (_, i) => i);
}
