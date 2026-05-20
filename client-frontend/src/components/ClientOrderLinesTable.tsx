import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import type { ComboboxOption } from '@wms/components/Combobox';
import { Combobox } from '@wms/components/Combobox';
import { TextField } from '@wms/components/TextField';

import type { ClientProductRow } from '../services/clientProductsService';

export type ClientOrderDraftLineRow = {
  lineKey: string;
  productId: string;
  quantity: string;
};

type ClientOrderLinesTableProps = {
  title: string;
  productHeader: string;
  lines: ClientOrderDraftLineRow[];
  productOptions: ComboboxOption[];
  productsById: Map<string, ClientProductRow>;
  pickProductPlaceholder: string;
  quantityHeader: string;
  emptyMessage: string;
  removeLabel: string;
  loading?: boolean;
  toolbar?: ReactNode;
  onUpdateLine: (lineKey: string, patch: { productId?: string; quantity?: string }) => void;
  onRemoveLine: (lineKey: string) => void;
  formatOnHand: (product: ClientProductRow) => string;
  onHandLabel: string;
  quantityError?: (row: ClientOrderDraftLineRow) => string | undefined;
  renderProductFooter?: (productId: string) => ReactNode;
};

export function ClientOrderLinesTable({
  title,
  productHeader,
  lines,
  productOptions,
  productsById,
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
  quantityError,
  renderProductFooter,
}: ClientOrderLinesTableProps) {
  const columns: Column<ClientOrderDraftLineRow>[] = useMemo(
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
                placeholder={pickProductPlaceholder}
                disabled={loading}
                clearable={false}
                dropdownInFlow
              />
              {product ? (
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
      pickProductPlaceholder,
      quantityHeader,
      removeLabel,
      loading,
      onUpdateLine,
      onRemoveLine,
      formatOnHand,
      onHandLabel,
      quantityError,
      renderProductFooter,
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
    />
  );
}
