import type { ReactNode } from 'react';

import { Badge, Card } from '@ds';

import type { Product } from '../../api/products';
import { productUomLabel } from '../../lib/ui-labels/products';
import {
  stockHealthLabel,
  stockHealthProgress,
  stockHealthStatus,
  type StockHealthStatus,
} from '../../lib/stock-health';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { StatusBadge } from '../StatusBadge';

function stockHealthTone(status: StockHealthStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'low_stock':
      return 'warning';
    case 'critical':
    case 'out_of_stock':
      return 'danger';
    default:
      return 'neutral';
  }
}

function stockHealthBarDs2(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-status-success-fg';
    case 'low_stock':
      return 'bg-status-warning-fg';
    case 'critical':
    case 'out_of_stock':
      return 'bg-status-danger-fg';
    default:
      return 'bg-border-strong';
  }
}

function trackingLabel(
  trackingType: Product['trackingType'],
  expiryTracking: boolean,
  t: ReturnType<typeof useWmsTranslation>['t'],
) {
  const base =
    trackingType === 'lot'
      ? 'Lot'
      : trackingType === 'package'
        ? t(['Package', 'حزمة'])
        : t(['None', 'لا شيء']);
  return expiryTracking
    ? `${base} · ${t(['Expiry tracked', 'تتبع تاريخ الانتهاء'])}`
    : base;
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
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <i className={`${iconClass} text-[11px] text-brand-600 dark:text-brand-400`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
    </div>
  );
}

function formatDimensions(
  product: Product,
  t: ReturnType<typeof useWmsTranslation>['t'],
): string {
  const l = display(product.lengthCm);
  const w = display(product.widthCm);
  const h = display(product.heightCm);
  if (l === '—' && w === '—' && h === '—') return '—';
  return `${l} × ${w} × ${h} ${t(['cm', 'سم'])}`;
}

export function ProductDetailsCard({ product }: { product: Product }) {
  const { t, isArabic } = useWmsTranslation();
  const summaryText = product.description?.trim() ?? '';
  const onHand = display(product.totalOnHand);
  const reserved = display(product.totalReserved);
  const stockNum = Number(product.totalOnHand ?? 0);
  const health = stockHealthStatus(stockNum, product.minStockThreshold);
  const percent = stockHealthProgress(stockNum, product.minStockThreshold);

  return (
    <Card padding="none" className="overflow-hidden">
      <Card.Body className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-card-muted text-brand-600 dark:text-brand-400"
            aria-hidden="true"
          >
            <i className="fa-solid fa-box text-xl" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-lg font-semibold leading-tight text-text-strong">{product.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-muted">
              <span className="font-mono">{product.sku}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex">
                <StatusBadge status={product.status} />
              </span>
              {health ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Badge tone={stockHealthTone(health)} size="xs" dot>
                    {stockHealthLabel(health, isArabic)}
                  </Badge>
                </>
              ) : null}
              {product.company?.name ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.company.name}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-text-strong">
          {t(['Product information', 'معلومات المنتج'])}
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ProductDetailField
            iconClass="fa-solid fa-building"
            label={t(['Client', 'العميل'])}
            value={product.company?.name ?? '—'}
          />
          <ProductDetailField iconClass="fa-solid fa-hashtag" label="SKU" value={<span className="font-mono">{product.sku}</span>} />
          <ProductDetailField
            iconClass="fa-solid fa-barcode"
            label="Barcode"
            value={
              product.barcode ? <span className="font-mono">{product.barcode}</span> : '—'
            }
          />
          <ProductDetailField
            iconClass="fa-solid fa-scale-balanced"
            label={t(['Unit of measure', 'وحدة القياس'])}
            value={productUomLabel(product.uom, t)}
          />
          <ProductDetailField
            iconClass="fa-solid fa-layer-group"
            label={t(['Tracking', 'التتبع'])}
            value={trackingLabel(product.trackingType, product.expiryTracking, t)}
          />
          <ProductDetailField
            iconClass="fa-solid fa-boxes-stacked"
            label={t(['On hand / Reserved', 'المتوفر / المحجوز'])}
            value={
              <div className="flex flex-col gap-1.5">
                <span className="font-mono tabular-nums">
                  {onHand} / {reserved}
                </span>
                {percent != null ? (
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={`h-full rounded-full ${stockHealthBarDs2(health)}`}
                      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                    />
                  </div>
                ) : null}
              </div>
            }
          />
          <ProductDetailField
            iconClass="fa-solid fa-chart-line"
            label={t(['Min stock threshold', 'حد المخزون الأدنى'])}
            value={
              Number(product.minStockThreshold) > 0
                ? display(product.minStockThreshold)
                : t(['Not configured', 'غير مُعد'])
            }
          />
          <ProductDetailField
            iconClass="fa-solid fa-heart-pulse"
            label={t(['Stock health', 'حالة المخزون'])}
            value={
              health ? (
                <Badge tone={stockHealthTone(health)} size="sm" dot>
                  {stockHealthLabel(health, isArabic)}
                </Badge>
              ) : (
                '—'
              )
            }
          />
          <ProductDetailField
            iconClass="fa-solid fa-ruler-combined"
            label={t(['Dimensions (L × W × H)', 'الأبعاد (ط × ع × ار)'])}
            value={formatDimensions(product, t)}
          />
          <ProductDetailField
            iconClass="fa-solid fa-weight-hanging"
            label={t(['Weight (kg)', 'الوزن (كغ)'])}
            value={display(product.weightKg)}
          />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <i className="fa-regular fa-file-lines text-sm text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-strong">{t(['Summary', 'ملخص'])}</h3>
        </div>
        <div className="mt-3 rounded-xl bg-surface-sunken px-4 py-3.5 text-sm leading-relaxed text-text-body">
          {summaryText || (
            <span className="text-text-faint">
              {t(['No description provided for this product.', 'لا يوجد وصف لهذا المنتج.'])}
            </span>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
