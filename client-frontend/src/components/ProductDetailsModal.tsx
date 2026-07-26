import { useQuery } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

import { Button, Modal } from '@ds';

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

type Props = {
  productId: string | null;
  productName?: string;
  open: boolean;
  onClose: () => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'Product details': 'تفاصيل المنتج',
    General: 'معلومات عامة',
    Inventory: 'المخزون',
    Dimensions: 'الأبعاد',
    Audit: 'التدقيق',
    Name: 'الاسم',
    SKU: 'رمز SKU',
    Barcode: 'الباركود',
    UoM: 'وحدة القياس',
    Category: 'الفئة',
    Description: 'الوصف',
    'Created by': 'أنشئ بواسطة',
    Created: 'تاريخ الإنشاء',
    'Last updated': 'آخر تحديث',
    'Stock on hand': 'المخزون المتوفر',
    'Committed stock': 'المخزون المحجوز',
    'Available for sale': 'المتاح للبيع',
    'Inventory method': 'طريقة الجرد',
    'Total inbound': 'إجمالي الوارد',
    'Total outbound': 'إجمالي الصادر',
    'Current inventory': 'المخزون الحالي',
    'Reserved quantity': 'الكمية المحجوزة',
    Length: 'الطول',
    Width: 'العرض',
    Height: 'الارتفاع',
    Weight: 'الوزن',
    'Volume (CBM)': 'الحجم (م³)',
    'Loading product…': 'جاري تحميل المنتج…',
    'Could not load product.': 'تعذر تحميل المنتج.',
    Close: 'إغلاق',
    cm: 'سم',
    kg: 'كغ',
  };
  return ar[text] ?? text;
}

function fmtQty(s: string | null | undefined): string {
  if (s == null) return '—';
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Row({
  label: rowLabel,
  value,
  mono,
  wide,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{rowLabel}</dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

export function ProductDetailsModal({
  productId,
  productName,
  open,
  onClose,
  isArabic,
}: Props): ReactElement {
  const t = (text: string) => label(text, isArabic);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', 'products', productId],
    queryFn: () => fetchClientProduct(productId as string),
    enabled: open && !!productId,
  });

  const uomLabel = (uom: string): string => {
    const u = UOM_LABELS[uom];
    return u ? (isArabic ? u.ar : u.en) : uom;
  };

  const dims = data
    ? [data.lengthCm, data.widthCm, data.heightCm].some((v) => v != null)
    : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('Product details')}${productName ? ` · ${productName}` : ''}`}
      widthClass="max-w-3xl"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('Close')}
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('Loading product…')}</p>
      ) : isError || !data ? (
        <p className="py-6 text-center text-sm text-rose-600">{t('Could not load product.')}</p>
      ) : (
        <div className="space-y-4">
          <Section title={t('General')}>
            <Row label={t('Name')} value={data.name} />
            <Row label={t('SKU')} value={data.sku} mono />
            <Row label={t('Barcode')} value={data.barcode ?? '—'} mono />
            <Row label={t('UoM')} value={uomLabel(data.uom)} />
            {data.category ? <Row label={t('Category')} value={data.category} /> : null}
            {data.description ? (
              <Row label={t('Description')} value={data.description} wide />
            ) : null}
          </Section>

          <Section title={t('Inventory')}>
            <Row label={t('Stock on hand')} value={fmtQty(data.totalOnHand)} mono />
            <Row label={t('Committed stock')} value={fmtQty(data.totalReserved)} mono />
            <Row label={t('Available for sale')} value={fmtQty(data.totalAvailable)} mono />
            <Row label={t('Inventory method')} value={data.inventoryMethod} />
            <Row label={t('Total inbound')} value={fmtQty(data.totalInboundQuantity)} mono />
            <Row label={t('Total outbound')} value={fmtQty(data.totalOutboundQuantity)} mono />
            <Row label={t('Current inventory')} value={fmtQty(data.totalOnHand)} mono />
            <Row label={t('Reserved quantity')} value={fmtQty(data.totalReserved)} mono />
          </Section>

          <Section title={t('Dimensions')}>
            <Row
              label={t('Length')}
              value={data.lengthCm ? `${data.lengthCm} ${t('cm')}` : '—'}
              mono
            />
            <Row
              label={t('Width')}
              value={data.widthCm ? `${data.widthCm} ${t('cm')}` : '—'}
              mono
            />
            <Row
              label={t('Height')}
              value={data.heightCm ? `${data.heightCm} ${t('cm')}` : '—'}
              mono
            />
            <Row
              label={t('Weight')}
              value={data.weightKg ? `${data.weightKg} ${t('kg')}` : '—'}
              mono
            />
            <Row
              label={t('Volume (CBM)')}
              value={data.volumeCbm ? fmtQty(data.volumeCbm) : dims ? '0' : '—'}
              mono
            />
          </Section>

          <Section title={t('Audit')}>
            {data.createdBy ? <Row label={t('Created by')} value={data.createdBy} /> : null}
            <Row label={t('Created')} value={fmtDateTime(data.createdAt)} />
            <Row label={t('Last updated')} value={fmtDateTime(data.updatedAt)} />
          </Section>
        </div>
      )}
    </Modal>
  );
}
