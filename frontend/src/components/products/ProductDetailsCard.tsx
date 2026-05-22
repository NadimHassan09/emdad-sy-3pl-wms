import type { ReactNode } from 'react';

import type { Product, ProductUom } from '../../api/products';
import { StatusBadge } from '../StatusBadge';

const UOM_LABELS: Record<ProductUom, string> = {
  piece: 'Piece',
  kg: 'Kilogram',
  litre: 'Litre',
  carton: 'Carton',
  pallet: 'Pallet',
  box: 'Box',
  roll: 'Roll',
};

function uomLabel(uom: ProductUom) {
  return UOM_LABELS[uom] ?? uom;
}

function trackingLabel(trackingType: Product['trackingType'], expiryTracking: boolean) {
  const base =
    trackingType === 'lot' ? 'Lot' : trackingType === 'package' ? 'Package' : 'None';
  return expiryTracking ? `${base} · Expiry tracked` : base;
}

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

function ProductDetailField({
  iconClass,
  label,
  value,
}: {
  iconClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <i className={`${iconClass} text-[11px] text-emerald-600/90`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatDimensions(product: Product): string {
  const l = display(product.lengthCm);
  const w = display(product.widthCm);
  const h = display(product.heightCm);
  if (l === '—' && w === '—' && h === '—') return '—';
  return `${l} × ${w} × ${h} cm`;
}

export function ProductDetailsCard({ product }: { product: Product }) {
  const summaryText = product.description?.trim() ?? '';
  const onHand = display(product.totalOnHand);
  const reserved = display(product.totalReserved);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-slate-50 ring-4 ring-slate-50"
          aria-hidden="true"
        >
          <i className="fa-solid fa-box text-xl text-emerald-600/80" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-slate-900">{product.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
            <span className="font-mono">{product.sku}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex">
              <StatusBadge status={product.status} />
            </span>
            {product.company?.name ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{product.company.name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-slate-800">Product information</h3>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ProductDetailField
          iconClass="fa-solid fa-building"
          label="Client"
          value={product.company?.name ?? '—'}
        />
        <ProductDetailField
          iconClass="fa-solid fa-hashtag"
          label="SKU"
          value={<span className="font-mono">{product.sku}</span>}
        />
        <ProductDetailField
          iconClass="fa-solid fa-barcode"
          label="Barcode"
          value={
            product.barcode ? <span className="font-mono">{product.barcode}</span> : '—'
          }
        />
        <ProductDetailField
          iconClass="fa-solid fa-scale-balanced"
          label="Unit of measure"
          value={uomLabel(product.uom)}
        />
        <ProductDetailField
          iconClass="fa-solid fa-layer-group"
          label="Tracking"
          value={trackingLabel(product.trackingType, product.expiryTracking)}
        />
        <ProductDetailField
          iconClass="fa-solid fa-boxes-stacked"
          label="On hand / Reserved"
          value={
            <span className="font-mono tabular-nums">
              {onHand} / {reserved}
            </span>
          }
        />
        <ProductDetailField
          iconClass="fa-solid fa-chart-line"
          label="Min stock threshold"
          value={display(product.minStockThreshold)}
        />
        <ProductDetailField
          iconClass="fa-solid fa-ruler-combined"
          label="Dimensions (L × W × H)"
          value={formatDimensions(product)}
        />
        <ProductDetailField
          iconClass="fa-solid fa-weight-hanging"
          label="Weight (kg)"
          value={display(product.weightKg)}
        />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <i className="fa-regular fa-file-lines text-sm text-emerald-600/90" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-800">Summary</h3>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
        {summaryText || (
          <span className="text-slate-400">No description provided for this product.</span>
        )}
      </div>
    </section>
  );
}
