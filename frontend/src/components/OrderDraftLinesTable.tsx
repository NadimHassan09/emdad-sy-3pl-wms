import type { ReactNode } from 'react';
import { useMemo } from 'react';

import type { Product } from '../api/products';
import { Button } from '@ds';
import { Combobox, type ComboboxOption } from './Combobox';
import { Column, DataTable } from './DataTable';
import { TextField } from './TextField';

export type OrderDraftLineRow = {
  lineKey: string;
  productId: string;
  quantity: string;
};

type OrderDraftLinesTableProps = {
  title: string;
  productHeader: string;
  lines: OrderDraftLineRow[];
  productOptions: ComboboxOption[];
  productsById: Map<string, Product>;
  companyId: string;
  companyDisabledMessage: string;
  pickProductPlaceholder: string;
  quantityHeader: string;
  emptyMessage: string;
  removeLabel: string;
  loading?: boolean;
  toolbar?: ReactNode;
  onUpdateLine: (lineKey: string, patch: { productId?: string; quantity?: string }) => void;
  onRemoveLine: (lineKey: string) => void;
  formatOnHand: (product: Product) => string;
  onHandLabel: string;
  showProductOnHand?: boolean;
  renderProductFooter?: (productId: string) => ReactNode;
  quantityError?: (row: OrderDraftLineRow) => string | undefined;
  tableLabels?: {
    rowsSuffix?: string;
    resultsSuffix?: string;
    ofWord?: string;
    previous?: string;
    next?: string;
    rowsPerPageAria?: string;
  };
};

export function OrderDraftLinesTable({
  title,
  productHeader,
  lines,
  productOptions,
  productsById,
  companyId,
  companyDisabledMessage,
  pickProductPlaceholder,
  quantityHeader,
  emptyMessage,
  removeLabel,
  loading,
  toolbar,
  onUpdateLine,
  onRemoveLine,
  formatOnHand,
  onHandLabel,
  showProductOnHand = true,
  renderProductFooter,
  quantityError,
  tableLabels,
}: OrderDraftLinesTableProps) {
  const columns: Column<OrderDraftLineRow>[] = useMemo(
    () => [
      {
        header: productHeader,
        accessor: (row) => {
          const product = row.productId ? productsById.get(row.productId) : undefined;
          return (
            <div className="min-w-[220px]">
              <Combobox
                value={row.productId}
                onChange={(v) => onUpdateLine(row.lineKey, { productId: v })}
                options={productOptions}
                placeholder={!companyId ? companyDisabledMessage : pickProductPlaceholder}
                disabled={!companyId || loading}
                clearable={false}
                dropdownInFlow
              />
              {showProductOnHand && product ? (
                <p className="mt-1 text-[11px] text-slate-600">
                  {onHandLabel}{' '}
                  <span className="font-mono font-semibold text-slate-900">{formatOnHand(product)}</span>{' '}
                  <span className="uppercase text-slate-700">{product.uom}</span>
                </p>
              ) : null}
              {row.productId && renderProductFooter?.(row.productId)}
            </div>
          );
        },
      },
      {
        header: quantityHeader,
        accessor: (row) => (
          <TextField
            type="number"
            min={0}
            step="0.0001"
            required
            value={row.quantity}
            onChange={(e) => onUpdateLine(row.lineKey, { quantity: e.target.value })}
            error={quantityError?.(row)}
            className="min-w-[120px]"
          />
        ),
        width: '160px',
      },
      {
        header: '',
        accessor: (row) =>
          lines.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => onRemoveLine(row.lineKey)}
            >
              {removeLabel}
            </Button>
          ) : (
            <span className="text-slate-400">—</span>
          ),
        width: '100px',
      },
    ],
    [
      productHeader,
      lines.length,
      productOptions,
      productsById,
      companyId,
      companyDisabledMessage,
      pickProductPlaceholder,
      quantityHeader,
      removeLabel,
      loading,
      onUpdateLine,
      onRemoveLine,
      formatOnHand,
      onHandLabel,
      showProductOnHand,
      renderProductFooter,
      quantityError,
    ],
  );

  return (
    <DataTable
      title={title}
      actions={toolbar}
      columns={columns}
      rows={lines}
      rowKey={(r) => r.lineKey}
      empty={emptyMessage}
      loading={loading}
      labels={tableLabels}
    />
  );
}
