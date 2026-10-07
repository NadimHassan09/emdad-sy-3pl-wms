import { PageResult, api } from './client';

export type AdjustmentStatus = 'draft' | 'approved' | 'cancelled';

/** Matches server placeholder until the user saves a real reason (approve is blocked). */
export const ADJUSTMENT_REASON_PENDING = '(pending)';

export interface StockAdjustmentLine {
  id: string;
  adjustmentId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantityBefore: string;
  quantityAfter: string;
  reasonNote: string | null;
  product: { id: string; sku: string; name: string; barcode: string | null; uom: string };
  location: { id: string; name: string; fullPath: string; barcode: string };
  lot: { id: string; lotNumber: string } | null;
}

export interface StockAdjustment {
  id: string;
  companyId: string;
  warehouseId: string;
  reason: string;
  status: AdjustmentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  creator: { id: string; fullName: string };
  approver: { id: string; fullName: string } | null;
  lines: StockAdjustmentLine[];
}

export interface CreateAdjustmentInput {
  companyId?: string;
  warehouseId: string;
  /** Omit to use server placeholder; set in the draft drawer before approve. */
  reason?: string;
}

export interface PatchAdjustmentInput {
  reason: string;
}

export interface AddAdjustmentLineInput {
  productId: string;
  locationId: string;
  lotId?: string;
  quantityAfter: number;
}

export interface PatchAdjustmentLineInput {
  quantityAfter?: number;
  reasonNote?: string;
}

export interface ListAdjustmentsQuery {
  companyId?: string;
  warehouseId?: string;
  adjustmentId?: string;
  productId?: string;
  lotId?: string;
  createdFrom?: string;
  createdTo?: string;
  status?: AdjustmentStatus;
  limit?: number;
  offset?: number;
}

export interface AdjustmentLineTableRow {
  rowKey: string;
  adjustmentId: string;
  productName: string;
  sku: string;
  productBarcode: string;
  clientName: string;
  lotIdLabel: string;
  quantityBefore: string;
  quantityAfter: string;
  createdAt: string;
  status: AdjustmentStatus;
  /** Present when the adjustment has no lines yet (draft row in the grid). */
  lineKind?: 'placeholder';
  parent: StockAdjustment;
}

export function flattenAdjustmentRows(items: StockAdjustment[]): AdjustmentLineTableRow[] {
  const rows: AdjustmentLineTableRow[] = [];
  for (const adj of items) {
    const clientName = adj.company?.name ?? '—';
    const status = adj.status;
    const lines = adj.lines ?? [];
    if (lines.length === 0) {
      rows.push({
        rowKey: `${adj.id}::__placeholder__`,
        adjustmentId: adj.id,
        productName: status === 'draft' ? '(No lines yet)' : '(No lines)',
        sku: '—',
        productBarcode: '—',
        clientName,
        lotIdLabel: '—',
        quantityBefore: '0',
        quantityAfter: '0',
        createdAt: adj.createdAt,
        status,
        lineKind: 'placeholder',
        parent: adj,
      });
      continue;
    }
    for (const ln of lines) {
      rows.push({
        rowKey: `${adj.id}::${ln.id}`,
        adjustmentId: adj.id,
        productName: ln.product.name,
        sku: ln.product.sku,
        productBarcode: ln.product.barcode?.trim() || '—',
        clientName,
        lotIdLabel: ln.lot?.id ?? ln.lotId ?? '—',
        quantityBefore: ln.quantityBefore,
        quantityAfter: ln.quantityAfter,
        createdAt: adj.createdAt,
        status,
        parent: adj,
      });
    }
  }
  return rows;
}

export const AdjustmentsApi = {
  async list(query: ListAdjustmentsQuery = {}): Promise<PageResult<StockAdjustment>> {
    const { data } = await api.get<PageResult<StockAdjustment>>('/adjustments', {
      params: { limit: 50, ...query },
    });
    return data;
  },
  async get(id: string): Promise<StockAdjustment> {
    const { data } = await api.get<StockAdjustment>(`/adjustments/${id}`);
    return data;
  },
  async create(input: CreateAdjustmentInput): Promise<StockAdjustment> {
    const body: Record<string, string> = { warehouseId: input.warehouseId };
    if (input.companyId?.trim()) body.companyId = input.companyId.trim();
    const r = input.reason?.trim();
    if (r) body.reason = r;
    const { data } = await api.post<StockAdjustment>('/adjustments', body);
    return data;
  },

  async patch(id: string, input: PatchAdjustmentInput): Promise<StockAdjustment> {
    const { data } = await api.patch<StockAdjustment>(`/adjustments/${id}`, input);
    return data;
  },
  async addLine(adjustmentId: string, input: AddAdjustmentLineInput): Promise<StockAdjustment> {
    const { data } = await api.post<StockAdjustment>(
      `/adjustments/${adjustmentId}/lines`,
      input,
    );
    return data;
  },
  async patchLine(
    adjustmentId: string,
    lineId: string,
    input: PatchAdjustmentLineInput,
  ): Promise<StockAdjustment> {
    const { data } = await api.patch<StockAdjustment>(
      `/adjustments/${adjustmentId}/lines/${lineId}`,
      input,
    );
    return data;
  },
  async approve(id: string): Promise<StockAdjustment> {
    const { data } = await api.post<StockAdjustment>(`/adjustments/${id}/approve`);
    return data;
  },
  async cancel(id: string): Promise<StockAdjustment> {
    const { data } = await api.post<StockAdjustment>(`/adjustments/${id}/cancel`);
    return data;
  },
};
