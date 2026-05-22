export type TaskLineFilters = {
  search: string;
  status: string;
};

export const DEFAULT_TASK_LINE_FILTERS: TaskLineFilters = {
  search: '',
  status: '',
};

export function taskLineFiltersWithSearch(
  current: TaskLineFilters,
  code: string,
): TaskLineFilters {
  return { ...current, search: code.trim() };
}

export type TaskLineSearchFields = {
  sku?: string | null;
  name?: string | null;
  barcode?: string | null;
  lot?: string | null;
  locationPath?: string | null;
};

export function matchesTaskLineSearch(
  query: string,
  fields: TaskLineSearchFields,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    fields.sku,
    fields.name,
    fields.barcode,
    fields.lot,
    fields.locationPath,
  ];
  return parts.some((p) => (p ?? '').trim().toLowerCase().includes(q));
}
