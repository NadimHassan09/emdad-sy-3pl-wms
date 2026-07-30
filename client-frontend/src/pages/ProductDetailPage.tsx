import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Skeleton } from '@ds';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientProduct } from '../services/clientProductsService';

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
    Reserved: 'محجوز',
    Available: 'متاح',
    Dimensions: 'الأبعاد (سم)',
    Weight: 'الوزن (كغ)',
    Created: 'تاريخ الإنشاء',
    Updated: 'تاريخ التحديث',
    Yes: 'نعم',
    No: 'لا',
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
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
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <i className={`fa-solid ${isArabic ? 'fa-arrow-right' : 'fa-arrow-left'} text-xs text-slate-400`} />
          {t('Back to products')}
        </Link>
      </div>

      {notFound ? (
        <Alert variant="error" title={t('Product not found.')} />
      ) : error ? (
        <Alert variant="error" title={t('Could not load product.')} />
      ) : null}

      <Card className="p-5 sm:p-6">
        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <Skeleton height={14} width="70%" />
            <Skeleton height={14} width="55%" />
            <Skeleton height={14} width="60%" />
            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          </div>
        ) : data ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">{data.name}</h2>
              <Badge status={data.status} />
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t('On hand')}
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                  {fmtQty(data.totalOnHand)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t('Reserved')}
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                  {fmtQty(data.totalReserved)}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  {t('Available')}
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-800">
                  {fmtQty(data.totalAvailable)}
                </div>
              </div>
            </div>

            <dl>
              <DetailRow label={t('SKU')}>
                <span className="font-mono text-sm">{data.sku}</span>
              </DetailRow>
              <DetailRow label={t('Barcode')}>
                <span className="font-mono text-sm">{data.barcode ?? '—'}</span>
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
              <DetailRow label={t('Min stock threshold')}>
                <span className="font-mono">{fmtQty(data.minStockThreshold)}</span>
              </DetailRow>
              {dimensions ? (
                <DetailRow label={t('Dimensions')}>
                  <span className="font-mono">{dimensions}</span>
                </DetailRow>
              ) : null}
              {data.weightKg ? (
                <DetailRow label={t('Weight')}>
                  <span className="font-mono">{data.weightKg}</span>
                </DetailRow>
              ) : null}
              <DetailRow label={t('Created')}>{formatDateTime(data.createdAt)}</DetailRow>
              <DetailRow label={t('Updated')}>{formatDateTime(data.updatedAt)}</DetailRow>
            </dl>
          </>
        ) : null}
      </Card>
    </div>
  );
}
