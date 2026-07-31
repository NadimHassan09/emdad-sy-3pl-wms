import type { ReactElement, ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Skeleton } from '@ds';

import { Badge } from '../design-v2/Badge';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientProduct } from '../services/clientProductsService';
import { clientMediaSrc } from '../lib/client-media';

const UOM_LABELS: Record<string, { en: string; ar: string }> = {
  piece: { en: 'Piece', ar: 'قطعة' },
  kg: { en: 'Kilogram', ar: 'كيلوغرام' },
  litre: { en: 'Litre', ar: 'لتر' },
  carton: { en: 'Carton', ar: 'كرتون' },
  pallet: { en: 'Pallet', ar: 'باليت' },
  box: { en: 'Box', ar: 'صندوق' },
  roll: { en: 'Roll', ar: 'لفة' },
};

function detailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Back to products': 'العودة إلى المنتجات',
    'Product not found.': 'المنتج غير موجود.',
    'Could not load product.': 'تعذر تحميل المنتج.',
    'Product details': 'تفاصيل المنتج',
    'Stock and catalog fields for this SKU': 'مخزون وحقول الكتالوج لهذا الصنف',
    Name: 'الاسم',
    SKU: 'رمز SKU',
    Barcode: 'الباركود',
    Description: 'الوصف',
    UoM: 'وحدة القياس',
    Status: 'الحالة',
    'Expiry tracking': 'تتبع انتهاء الصلاحية',
    'Min stock threshold': 'حد المخزون الأدنى',
    'On hand': 'المتوفر',
    'Total on hand': 'إجمالي المتوفر',
    Reserved: 'محجوز',
    Available: 'متاح',
    'Available for sale': 'متاح للبيع',
    Dimensions: 'الأبعاد',
    'Dimensions & weight': 'الأبعاد والوزن',
    'Identity & classification': 'الهوية والتصنيف',
    Weight: 'الوزن',
    Created: 'تاريخ الإنشاء',
    Updated: 'تاريخ التحديث',
    Yes: 'نعم',
    No: 'لا',
    units: 'وحدة',
    cm: 'سم',
    kg: 'كغ',
  };
  return ar[label] ?? label;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fmtQty(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function MetricCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}): ReactElement {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        emphasis
          ? 'border-brand-200 bg-brand-50 dark:border-white/10 dark:bg-white/5'
          : 'border-border-subtle bg-surface-card-muted'
      }`}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          emphasis ? 'text-brand-700 dark:text-brand-400' : 'text-text-muted'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-xl font-bold tabular-nums ${
          emphasis ? 'text-brand-800 dark:text-brand-300' : 'text-text-strong'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border-subtle py-2.5 last:border-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm text-text-body">{children}</dd>
    </div>
  );
}

export function ProductDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const isArabic = isClientArabic();
  const t = (label: string) => detailLabel(label, isArabic);

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'products', id],
    queryFn: () => fetchClientProduct(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  const uomLabel = data
    ? (() => {
        const u = UOM_LABELS[data.uom];
        return u ? (isArabic ? u.ar : u.en) : data.uom;
      })()
    : '';

  const dimensions =
    data && (data.lengthCm || data.widthCm || data.heightCm)
      ? [data.lengthCm, data.widthCm, data.heightCm].filter(Boolean).join(' × ')
      : null;

  return (
    <div className="animate-enter space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListPageHeader
          icon="fa-box"
          title={data?.name ?? t('Product details')}
          subtitle={t('Stock and catalog fields for this SKU')}
        />
        <Link
          to="/products"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-panel px-3 py-2 text-sm font-medium text-text-body transition hover:bg-surface-hover"
        >
          <i className={`fa-solid ${isArabic ? 'fa-arrow-right' : 'fa-arrow-left'} text-xs text-text-faint`} />
          {t('Back to products')}
        </Link>
      </div>

      {notFound ? (
        <Alert variant="error" title={t('Product not found.')} />
      ) : error ? (
        <Alert variant="error" title={t('Could not load product.')} />
      ) : null}

      {isLoading ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
            <Skeleton height={140} />
          </div>
        </Card>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {clientMediaSrc(data.imageUrl) ? (
              <img
                src={clientMediaSrc(data.imageUrl) ?? undefined}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-card-muted text-text-faint">
                <i className="fa-solid fa-box text-lg" aria-hidden="true" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-text-strong">{data.name}</h2>
              <Badge status={data.status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label={t('Available for sale')} value={fmtQty(data.totalAvailable)} emphasis />
            <MetricCard label={t('Reserved')} value={fmtQty(data.totalReserved)} />
            <MetricCard label={t('Total on hand')} value={fmtQty(data.totalOnHand)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card padding="none">
              <Card.Header>
                <Card.Title>{t('Identity & classification')}</Card.Title>
              </Card.Header>
              <Card.Body>
                <dl>
                  <DetailRow label={t('SKU')}>
                    <span className="font-mono">{data.sku}</span>
                  </DetailRow>
                  <DetailRow label={t('Barcode')}>
                    <span className="font-mono">{data.barcode ?? '—'}</span>
                  </DetailRow>
                  {data.description ? (
                    <DetailRow label={t('Description')}>
                      <span className="whitespace-pre-wrap">{data.description}</span>
                    </DetailRow>
                  ) : null}
                  <DetailRow label={t('UoM')}>{uomLabel}</DetailRow>
                  <DetailRow label={t('Expiry tracking')}>
                    {data.expiryTracking ? t('Yes') : t('No')}
                  </DetailRow>
                </dl>
              </Card.Body>
            </Card>

            <Card padding="none">
              <Card.Header>
                <Card.Title>{t('Dimensions & weight')}</Card.Title>
              </Card.Header>
              <Card.Body>
                <dl>
                  <DetailRow label={t('Min stock threshold')}>
                    <span className="font-mono">
                      {fmtQty(data.minStockThreshold)} {t('units')}
                    </span>
                  </DetailRow>
                  {dimensions ? (
                    <DetailRow label={t('Dimensions')}>
                      <span className="font-mono">
                        {dimensions} {t('cm')}
                      </span>
                    </DetailRow>
                  ) : null}
                  {data.weightKg ? (
                    <DetailRow label={t('Weight')}>
                      <span className="font-mono">
                        {data.weightKg} {t('kg')}
                      </span>
                    </DetailRow>
                  ) : null}
                  <DetailRow label={t('Created')}>{formatDateTime(data.createdAt)}</DetailRow>
                  <DetailRow label={t('Updated')}>{formatDateTime(data.updatedAt)}</DetailRow>
                </dl>
              </Card.Body>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
