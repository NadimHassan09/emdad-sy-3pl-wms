import type { CodRecordStatus } from '../api/oms';

export type CodListFilters = {
  search?: string;
  status?: string;
  companyId?: string;
  createdFrom?: string;
  createdTo?: string;
  amountMin?: string;
  amountMax?: string;
};

/** Shared list + Excel/PDF export query from the applied COD filters. */
export function buildCodListParams(applied: CodListFilters): {
  search?: string;
  status?: CodRecordStatus;
  companyId?: string;
  createdFrom?: string;
  createdTo?: string;
  amountMin?: number;
  amountMax?: number;
} {
  return {
    search: (applied.search ?? '').trim() || undefined,
    status: ((applied.status ?? '').trim() || undefined) as CodRecordStatus | undefined,
    companyId: (applied.companyId ?? '').trim() || undefined,
    createdFrom: (applied.createdFrom ?? '').trim() || undefined,
    createdTo: (applied.createdTo ?? '').trim() || undefined,
    amountMin: (applied.amountMin ?? '').trim() ? Number(applied.amountMin) : undefined,
    amountMax: (applied.amountMax ?? '').trim() ? Number(applied.amountMax) : undefined,
  };
}
