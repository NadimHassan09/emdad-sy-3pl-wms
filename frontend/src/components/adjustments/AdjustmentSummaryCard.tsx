import type { ReactNode } from 'react';

import { ADJUSTMENT_REASON_PENDING, type StockAdjustment } from '../../api/adjustments';
import { StatusBadge } from '../StatusBadge';

export function AdjustmentDetailField({
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
        <i className={`${iconClass} text-[11px] text-brand-600/80`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function AdjustmentSummaryCard({
  adjustment,
  t,
}: {
  adjustment: StockAdjustment;
  t: (en: string, ar: string) => string;
}) {
  const lines = adjustment.lines ?? [];
  const skuSummary =
    lines.length === 0
      ? '—'
      : lines.length === 1
        ? lines[0]!.product.sku
        : `${lines[0]!.product.sku} +${lines.length - 1}`;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-50 ring-4 ring-slate-50"
          aria-hidden="true"
        >
          <i className="fa-solid fa-sliders text-xl text-slate-500" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-slate-900">
            {t('Adjustment information', 'معلومات التعديل')}
          </h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AdjustmentDetailField
          iconClass="fa-solid fa-sliders"
          label={t('Movement type', 'نوع الحركة')}
          value={t('Adjustments', 'تعديلات')}
        />
        <AdjustmentDetailField
          iconClass="fa-solid fa-hashtag"
          label={t('Product SKU', 'رمز الصنف')}
          value={<span className="font-mono font-semibold">{skuSummary}</span>}
        />
        <AdjustmentDetailField
          iconClass="fa-solid fa-fingerprint"
          label={t('Adjustment ID', 'معرف التعديل')}
          value={<span className="font-mono text-xs font-semibold">{adjustment.id}</span>}
        />
        <AdjustmentDetailField
          iconClass="fa-solid fa-building"
          label={t('Client', 'العميل')}
          value={adjustment.company?.name ?? '—'}
        />
        <AdjustmentDetailField
          iconClass="fa-solid fa-circle-info"
          label={t('Status', 'الحالة')}
          value={<StatusBadge status={adjustment.status} />}
        />
        <AdjustmentDetailField
          iconClass="fa-solid fa-comment"
          label={t('Reason', 'السبب')}
          value={
            adjustment.reason === ADJUSTMENT_REASON_PENDING ? (
              <span className="font-normal italic text-slate-400">{t('(pending)', '(قيد الانتظار)')}</span>
            ) : (
              adjustment.reason
            )
          }
        />
        {adjustment.warehouse ? (
          <AdjustmentDetailField
            iconClass="fa-solid fa-warehouse"
            label={t('Warehouse', 'المستودع')}
            value={`${adjustment.warehouse.code} — ${adjustment.warehouse.name}`}
          />
        ) : null}
      </div>
    </section>
  );
}
