import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { isClientArabic } from '../lib/client-ui-language';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
  lineTotalByType,
  parseRateSnapshot,
  renewalStatusLabel,
} from '../lib/billing-display';
import { fetchClientInvoice } from '../services/clientBillingService';

function detailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    '← Back to billing': '← العودة إلى الفوترة',
    'Invoice not found.': 'الفاتورة غير موجودة.',
    'Could not load this invoice. Please try again.': 'تعذر تحميل هذه الفاتورة. حاول مرة أخرى.',
    'Loading invoice…': 'جاري تحميل الفاتورة…',
    Summary: 'ملخص',
    'Billing cycle': 'دورة الفوترة',
    Created: 'تاريخ الإنشاء',
    Issued: 'تاريخ الإصدار',
    'Billing plan snapshot': 'لقطة خطة الفوترة',
    'No rate snapshot for this billing cycle.': 'لا توجد لقطة أسعار لهذه الدورة.',
    'Fixed subscription fee': 'رسوم الاشتراك الثابتة',
    'Inbound order fee': 'رسوم طلب الوارد',
    'Outbound order fee': 'رسوم طلب الصادر',
    'Packaging fee': 'رسوم التغليف',
    'Quality check fee': 'رسوم فحص الجودة',
    'Excess volume / day': 'حجم زائد / يوم',
    'Excess weight / day': 'وزن زائد / يوم',
    'Reserved volume': 'الحجم المحجوز',
    'Reserved weight': 'الوزن المحجوز',
    CBM: 'م³',
    kg: 'كغ',
    'Snapshotted at': 'تاريخ اللقطة',
    'Invoice lines': 'بنود الفاتورة',
    'Fixed subscription': 'الاشتراك الثابت',
    'Inbound totals': 'إجمالي الوارد',
    'Outbound totals': 'إجمالي الصادر',
    'Packaging totals': 'إجمالي التغليف',
    'Quality check totals': 'إجمالي فحص الجودة',
    'Volume charges': 'رسوم الحجم',
    'Weight charges': 'رسوم الوزن',
    'Grand total': 'الإجمالي',
    'Renewal status': 'حالة التجديد',
    'Cycle status': 'حالة الدورة',
    'Cycle ends': 'نهاية الدورة',
    'Days remaining': 'الأيام المتبقية',
  };
  return ar[label] ?? label;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="details__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ChargeRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
      }}
    >
      <span>{label}</span>
      <span className="font-mono" dir="ltr">
        {formatDecimal(amount)}
      </span>
    </div>
  );
}

export function BillingInvoiceDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const isArabic = isClientArabic();
  const t = (label: string) => detailLabel(label, isArabic);

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'billing', 'invoices', id],
    queryFn: () => fetchClientInvoice(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;
  const snapshot = parseRateSnapshot(data?.billingCycle?.rateSnapshot);
  const lines = data?.lines ?? [];
  const cycle = data?.billingCycle;

  return (
    <main className="main">
      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          <Link className="muted" to="/billing" style={{ textDecoration: 'none' }}>
            {t('← Back to billing')}
          </Link>
        </p>

        {notFound ? (
          <p className="banner banner--error" role="alert">
            {t('Invoice not found.')}
          </p>
        ) : error ? (
          <p className="banner banner--error" role="alert">
            {t('Could not load this invoice. Please try again.')}
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">{t('Loading invoice…')}</p>
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
                Invoice <span dir="ltr">{data.invoiceNumber}</span>
              </h1>
              <span className={invoiceStatusClass(data.status)}>
                {humanizeInvoiceStatus(data.status)}
              </span>
            </div>

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Summary')}</h2>
              <dl className="details">
                <DetailRow label={t('Billing cycle')} value={formatCycleLabel(cycle)} />
                <DetailRow label={t('Created')} value={formatDate(data.createdAt)} />
                <DetailRow
                  label={t('Issued')}
                  value={data.issuedAt ? formatDate(data.issuedAt) : '—'}
                />
              </dl>
            </section>

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Billing plan snapshot')}</h2>
              {snapshot ? (
                <dl className="details">
                  <DetailRow
                    label={t('Fixed subscription fee')}
                    value={formatDecimal(snapshot.fixedSubscriptionFee)}
                  />
                  <DetailRow
                    label={t('Inbound order fee')}
                    value={formatDecimal(snapshot.inboundOrderFee, 4)}
                  />
                  <DetailRow
                    label={t('Outbound order fee')}
                    value={formatDecimal(snapshot.outboundOrderFee, 4)}
                  />
                  <DetailRow label={t('Packaging fee')} value={formatDecimal(snapshot.packagingFee, 4)} />
                  <DetailRow
                    label={t('Quality check fee')}
                    value={formatDecimal(snapshot.qualityCheckFee, 4)}
                  />
                  <DetailRow
                    label={t('Excess volume / day')}
                    value={formatDecimal(snapshot.excessVolumeFeePerDay, 4)}
                  />
                  <DetailRow
                    label={t('Excess weight / day')}
                    value={formatDecimal(snapshot.excessWeightFeePerDay, 4)}
                  />
                  <DetailRow
                    label={t('Reserved volume')}
                    value={`${formatDecimal(snapshot.reservedVolume, 4)} ${t('CBM')}`}
                  />
                  <DetailRow
                    label={t('Reserved weight')}
                    value={`${formatDecimal(snapshot.reservedWeight, 4)} ${t('kg')}`}
                  />
                  {snapshot.snapshottedAt ? (
                    <DetailRow label={t('Snapshotted at')} value={formatDate(snapshot.snapshottedAt)} />
                  ) : null}
                </dl>
              ) : (
                <p className="muted">{t('No rate snapshot for this billing cycle.')}</p>
              )}
            </section>

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Invoice lines')}</h2>
              <ChargeRow label={t('Fixed subscription')} amount={lineTotalByType(lines, 'subscription')} />
              <ChargeRow label={t('Inbound totals')} amount={lineTotalByType(lines, 'inbound')} />
              <ChargeRow label={t('Outbound totals')} amount={lineTotalByType(lines, 'outbound')} />
              <ChargeRow label={t('Packaging totals')} amount={lineTotalByType(lines, 'packaging')} />
              <ChargeRow
                label={t('Quality check totals')}
                amount={lineTotalByType(lines, 'quality_check')}
              />
              <ChargeRow label={t('Volume charges')} amount={lineTotalByType(lines, 'excess_volume')} />
              <ChargeRow label={t('Weight charges')} amount={lineTotalByType(lines, 'excess_weight')} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                  borderTop: '2px solid var(--border-subtle, #cbd5e1)',
                  fontWeight: 600,
                }}
              >
                <span>{t('Grand total')}</span>
                <span className="font-mono" dir="ltr">
                  {formatDecimal(data.totalAmount)}
                </span>
              </div>
            </section>

            <section>
              <h2 className="card__subtitle">{t('Renewal status')}</h2>
              <dl className="details">
                <DetailRow label={t('Cycle status')} value={renewalStatusLabel(cycle?.status)} />
                <DetailRow label={t('Cycle ends')} value={formatDate(cycle?.endsAt)} />
                <DetailRow
                  label={t('Days remaining')}
                  value={
                    cycle?.endsAt
                      ? String(
                          Math.max(
                            0,
                            Math.ceil(
                              (new Date(cycle.endsAt).getTime() - Date.now()) / 86_400_000,
                            ),
                          ),
                        )
                      : '—'
                  }
                />
              </dl>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
