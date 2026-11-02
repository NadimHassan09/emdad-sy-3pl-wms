import type { OrderProductCatalog, ShippingCartonValue } from './carrier-shipping-form';
import { cartonWeightKg, emptyCartonLine } from './carrier-shipping-form';
import { TextField } from '../TextField';

type Props = {
  cartons: ShippingCartonValue[];
  catalog: OrderProductCatalog[];
  readOnly?: boolean;
  isArabic?: boolean;
  onChange: (cartons: ShippingCartonValue[]) => void;
};

function patchCarton(
  cartons: ShippingCartonValue[],
  cartonId: string,
  partial: Partial<ShippingCartonValue>,
): ShippingCartonValue[] {
  return cartons.map((c) => (c.cartonId === cartonId ? { ...c, ...partial } : c));
}

export function ShippingCartonEditor({
  cartons,
  catalog,
  readOnly = false,
  isArabic = false,
  onChange,
}: Props) {
  if (catalog.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        {isArabic ? 'لا توجد منتجات في هذا الطلب.' : 'No line items on this order.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {cartons.map((carton, index) => {
        const weight = cartonWeightKg(carton, catalog);
        return (
          <div
            key={carton.cartonId}
            className="space-y-3 rounded-lg border border-border-subtle bg-surface-sunken/40 p-3"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-text-strong">
              <span>{isArabic ? `الطرد ${index + 1}` : `Package ${index + 1}`}</span>
              <span className="text-xs font-normal text-text-muted">
                {isArabic ? `الوزن: ${weight} كغ` : `Weight: ${weight} kg`}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
                {isArabic ? 'المنتجات في هذا الطرد' : 'Products in this package'}
              </div>

              {carton.lines.length === 0 ? (
                <div className="rounded-md border border-dashed border-border-subtle p-3 text-center text-xs text-text-muted">
                  {isArabic
                    ? 'لم تتم إضافة أي منتج في هذا الطرد بعد.'
                    : 'No products added to this package yet.'}
                </div>
              ) : null}

              {carton.lines.map((line) => (
                <div
                  key={line.lineId}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem_auto]"
                >
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-text-muted">
                      {isArabic ? 'المنتج' : 'Product'}
                    </span>
                    <select
                      disabled={readOnly}
                      value={line.productId}
                      onChange={(e) =>
                        onChange(
                          patchCarton(cartons, carton.cartonId, {
                            lines: carton.lines.map((ln) =>
                              ln.lineId === line.lineId
                                ? { ...ln, productId: e.target.value }
                                : ln,
                            ),
                          }),
                        )
                      }
                      className="w-full rounded-lg border border-border-subtle bg-surface-card px-2 py-2 text-sm"
                    >
                      <option value="">
                        {isArabic ? 'اختر المنتج…' : 'Select product…'}
                      </option>
                      {catalog.map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.productName} ({isArabic ? 'الطلب' : 'ordered'}: {p.orderedQty})
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label={isArabic ? 'الكمية' : 'Qty'}
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange(
                        patchCarton(cartons, carton.cartonId, {
                          lines: carton.lines.map((ln) =>
                            ln.lineId === line.lineId
                              ? { ...ln, quantity: e.target.value }
                              : ln,
                          ),
                        }),
                      )
                    }
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        onChange(
                          patchCarton(cartons, carton.cartonId, {
                            lines: carton.lines.filter((ln) => ln.lineId !== line.lineId),
                          }),
                        )
                      }
                      className="rounded-lg border border-border-subtle px-2 py-2 text-xs text-text-muted hover:bg-surface-card disabled:opacity-40"
                    >
                      {isArabic ? 'حذف' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      patchCarton(cartons, carton.cartonId, {
                        lines: [
                          ...carton.lines,
                          emptyCartonLine(catalog[0]?.productId ?? ''),
                        ],
                      }),
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  <i className="fa-solid fa-plus text-[10px]" />
                  <span>{isArabic ? 'إضافة منتج إلى الطرد' : '+ Add product'}</span>
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <TextField
                label={isArabic ? 'الطول (سم)' : 'Length (cm)'}
                type="number"
                min={0}
                step="0.1"
                value={carton.lengthCm}
                disabled={readOnly}
                onChange={(e) =>
                  onChange(
                    patchCarton(cartons, carton.cartonId, { lengthCm: e.target.value }),
                  )
                }
              />
              <TextField
                label={isArabic ? 'العرض (سم)' : 'Width (cm)'}
                type="number"
                min={0}
                step="0.1"
                value={carton.widthCm}
                disabled={readOnly}
                onChange={(e) =>
                  onChange(
                    patchCarton(cartons, carton.cartonId, { widthCm: e.target.value }),
                  )
                }
              />
              <TextField
                label={isArabic ? 'الارتفاع (سم)' : 'Height (cm)'}
                type="number"
                min={0}
                step="0.1"
                value={carton.heightCm}
                disabled={readOnly}
                onChange={(e) =>
                  onChange(
                    patchCarton(cartons, carton.cartonId, { heightCm: e.target.value }),
                  )
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PackingSummaryPanel({
  rows,
  isArabic = false,
}: {
  rows: Array<{
    productName: string;
    ordered: number;
    packed: number;
    remaining: number;
    overPacked: boolean;
  }>;
  isArabic?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-sunken/30 p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
        {isArabic ? 'ملخص توزيع المنتجات على الطرود' : 'Packing summary'}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.productName}
            className={`flex flex-wrap justify-between gap-2 text-xs ${
              r.overPacked ? 'text-status-warning-fg font-semibold' : 'text-text-body'
            }`}
          >
            <span className="font-medium">{r.productName}</span>
            <span>
              {isArabic
                ? `المطلوب: ${r.ordered} · الموزع: ${r.packed} · المتبقي: ${r.remaining}${
                    r.overPacked ? ' · تجاوز الكمية المطلوبة!' : ''
                  }`
                : `Ordered: ${r.ordered} · Packed: ${r.packed} · Remaining: ${r.remaining}${
                    r.overPacked ? ' · Over limit!' : ''
                  }`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
