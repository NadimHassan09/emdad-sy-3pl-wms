import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

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
    '← Back to products': '← العودة إلى المنتجات',
    'Product not found.': 'المنتج غير موجود.',
    'Could not load product.': 'تعذر تحميل المنتج.',
    'Loading product…': 'جاري تحميل المنتج…',
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

function productStatusClass(status: string): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'suspended') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
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
    <main className="main">
      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          <Link className="muted" to="/products" style={{ textDecoration: 'none' }}>
            {t('← Back to products')}
          </Link>
        </p>

        {notFound ? (
          <p className="banner banner--error" role="alert">
            {t('Product not found.')}
          </p>
        ) : error ? (
          <p className="banner banner--error" role="alert">
            {t('Could not load product.')}
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">{t('Loading product…')}</p>
        ) : data ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <h1 className="card__title" style={{ margin: 0 }}>
                {data.name}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${productStatusClass(data.status)}`}
              >
                {data.status}
              </span>
            </div>

            <dl className="details">
              <div className="details__row">
                <dt>{t('SKU')}</dt>
                <dd className="font-mono text-sm">{data.sku}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Barcode')}</dt>
                <dd className="font-mono text-sm">{data.barcode ?? '—'}</dd>
              </div>
              {data.description ? (
                <div className="details__row">
                  <dt>{t('Description')}</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{data.description}</dd>
                </div>
              ) : null}
              <div className="details__row">
                <dt>{t('UoM')}</dt>
                <dd>{uomLabel}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Expiry tracking')}</dt>
                <dd>{data.expiryTracking ? t('Yes') : t('No')}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Min stock threshold')}</dt>
                <dd className="font-mono">{fmtQty(data.minStockThreshold)}</dd>
              </div>
              <div className="details__row">
                <dt>{t('On hand')}</dt>
                <dd className="font-mono font-semibold">{fmtQty(data.totalOnHand)}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Reserved')}</dt>
                <dd className="font-mono">{fmtQty(data.totalReserved)}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Available')}</dt>
                <dd className="font-mono font-semibold">{fmtQty(data.totalAvailable)}</dd>
              </div>
              {dimensions ? (
                <div className="details__row">
                  <dt>{t('Dimensions')}</dt>
                  <dd className="font-mono">{dimensions}</dd>
                </div>
              ) : null}
              {data.weightKg ? (
                <div className="details__row">
                  <dt>{t('Weight')}</dt>
                  <dd className="font-mono">{data.weightKg}</dd>
                </div>
              ) : null}
              <div className="details__row">
                <dt>{t('Created')}</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Updated')}</dt>
                <dd>{formatDateTime(data.updatedAt)}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </main>
  );
}
