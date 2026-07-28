import type { ReactNode } from 'react';

import { Button } from '@ds';
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

/** Compact draft-lines editor — no list pagination (create/edit modals). */
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
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {toolbar}
      </div>
      {lines.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-start">{productHeader}</th>
                <th className="px-3 py-2 text-start w-[160px]">{quantityHeader}</th>
                <th className="px-3 py-2 text-start w-[100px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((row) => {
                const product = row.productId ? productsById.get(row.productId) : undefined;
                return (
                  <tr key={row.lineKey}>
                    <td className="px-3 py-2.5 align-top">
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
                            <span className="font-mono font-semibold text-slate-900">
                              {formatOnHand(product)}
                            </span>{' '}
                            <span className="uppercase text-slate-700">{product.uom}</span>
                          </p>
                        ) : null}
                        {row.productId ? renderProductFooter?.(row.productId) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <TextField
                        type="number"
                        min={0}
                        step="0.0001"
                        required
                        aria-label={quantityHeader}
                        value={row.quantity}
                        onChange={(e) => onUpdateLine(row.lineKey, { quantity: e.target.value })}
                        error={quantityError?.(row)}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {lines.length > 1 ? (
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
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
