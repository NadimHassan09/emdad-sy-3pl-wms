import { PageResult, api } from './client';

export interface StockQuery {
  productId?: string;
  warehouseId?: string;
  locationId?: string;
  sku?: string;
  /** Substring match on product name or SKU (server-side). */
  productSearch?: string;
  /** Substring match on product name (AND with sku / productBarcode when used). */
  productName?: string;
  /** Substring match on product barcode. */
  productBarcode?: string;
  lotNumber?: string;
  packageId?: string;
  inboundOrderId?: string;
  /** Substring match on inbound order number (receive ledger). */
  inboundOrderNumber?: string;
  locationBarcodeOrId?: string;
  companyId?: string;
  limit?: number;
  offset?: number;
}

export interface ProductStockSummaryRow {
  productId: string;
  totalQuantity: string;
  product: { id: string; sku: string; name: string; uom: string; barcode: string | null };
  client: { id: string; name: string };
}

export interface StockRow {
  id: string;
  companyId: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId: string | null;
  packageId?: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  status: 'available' | 'quarantined';
  lastMovementAt: string | null;
  product: { id: string; sku: string; name: string; uom: string };
  location: { id: string; name: string; fullPath: string; barcode: string };
  warehouse: { id: string; code: string; name: string };
  lot: { id: string; lotNumber: string; expiryDate: string | null } | null;
}

export interface AvailabilityResult {
  productId: string;
  companyId: string;
  onHand: string;
  reserved: string;
  available: string;
}

export interface LedgerRow {
  id: string;
  productId: string;
  companyId: string;
  company: { id: string; name: string };
  lotId: string | null;
  idempotencyKey?: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  locationId: string | null;
  locationLabel: string | null;
  movementType: string;
  quantity: string;
  quantityChange: string;
  quantityBefore: string | null;
  quantityAfter: string | null;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  notes: string | null;
  product: { id: string; sku: string; name: string };
  lot: { id: string; lotNumber: string } | null;
  operator: { id: string; fullName: string };
}

export interface LedgerEntryResponse {
  lines: LedgerRow[];
}

export interface LedgerQuery {
  productId?: string;
  companyId?: string;
  warehouseId?: string;
  movementType?: 'inbound' | 'outbound' | 'adjustment' | string;
  referenceType?: string;
  referenceId?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
}

export interface InternalTransferInput {
  companyId?: string;
  productId: string;
  lotId?: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
}

export interface InternalTransferResult {
  referenceId: string;
  ledger: LedgerRow;
}

function companyHeaders(companyIdOverride?: string) {
  return companyIdOverride ? { headers: { 'X-Company-Id': companyIdOverride } } : undefined;
}

export const InventoryApi = {
  async stock(query: StockQuery = {}): Promise<PageResult<StockRow>> {
    const { data } = await api.get<PageResult<StockRow>>('/inventory/stock', {
      params: { limit: 200, ...query },
    });
    return data;
  },

  /** Per-product on-hand totals for the main inventory grid. */
  async stockByProductSummary(query: StockQuery = {}): Promise<PageResult<ProductStockSummaryRow>> {
    const { data } = await api.get<PageResult<ProductStockSummaryRow>>('/inventory/stock/by-product', {
      params: { limit: 200, ...query },
    });
    return data;
  },

  /** Alias of `/inventory/stock` for naming parity with API docs. */
  async currentStock(query: StockQuery = {}): Promise<PageResult<StockRow>> {
    const { data } = await api.get<PageResult<StockRow>>('/inventory/current-stock', {
      params: { limit: 200, ...query },
    });
    return data;
  },

  async ledger(query: LedgerQuery = {}): Promise<PageResult<LedgerRow>> {
    const { data } = await api.get<PageResult<LedgerRow>>('/inventory/ledger', {
      params: { limit: 100, ...query },
    });
    return data;
  },

  /** One movement by ledger line id + createdAt (composite PK); includes sibling lines with same idempotency key. */
  async ledgerEntry(params: {
    ledgerId: string;
    createdAt: string;
    warehouseId?: string;
    companyIdOverride?: string;
  }): Promise<LedgerEntryResponse> {
    const { data } = await api.get<LedgerEntryResponse>(
      '/inventory/ledger/entry',
      {
        params: {
          ledgerId: params.ledgerId,
          createdAt: params.createdAt,
          warehouseId: params.warehouseId,
        },
      ...(companyHeaders(params.companyIdOverride) ?? {}),
      },
    );
    return data;
  },

  async availability(productId: string, companyIdOverride?: string): Promise<AvailabilityResult> {
    const { data } = await api.get<AvailabilityResult>('/inventory/availability', {
      params: { productId, ...(companyIdOverride ? { companyId: companyIdOverride } : {}) },
      ...(companyHeaders(companyIdOverride) ?? {}),
    });
    return data;
  },

  async internalTransfer(body: InternalTransferInput): Promise<InternalTransferResult> {
    const { data } = await api.post<InternalTransferResult>('/inventory/internal-transfer', body);
    return data;
  },
};
