import { useEffect, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  ClientDetailShell,
  DetailField,
  DetailGrid,
  DetailSection,
} from '../components/ClientDetailShell';
import { isClientArabic } from '../lib/client-ui-language';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
  lineTotalByType,
  parseRateSnapshot,
} from '../lib/billing-display';
import { fetchClientInvoice, fetchClientInvoiceBreakdown } from '../services/clientBillingService';

const CURRENCY = 'USD';

function detailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Back to invoices': 'العودة إلى الفواتير',
    'Invoice not found': 'الفاتورة غير موجودة',
    'This invoice is missing or you do not have access.':
      'الفاتورة غير موجودة أو ليس لديك صلاحية الوصول.',
    'Could not load this invoice': 'تعذر تحميل هذه الفاتورة',
    'Please try again.': 'حاول مرة أخرى.',
    'Loading invoice…': 'جاري تحميل الفاتورة…',
    Invoice: 'فاتورة',
    Print: 'طباعة',
    Summary: 'ملخص',
    'Billing period': 'فترة الفوترة',
    'Invoice date': 'تاريخ الفاتورة',
    'Due date': 'تاريخ الاستحقاق',
    Created: 'تاريخ الإنشاء',
    Amount: 'المبلغ',
    Currency: 'العملة',
    'Payment status': 'حالة الدفع',
    'Billing plan snapshot': 'لقطة خطة الفوترة',
    'No rate snapshot for this billing cycle.': 'لا توجد لقطة أسعار لهذه الدورة.',
    'Fixed subscription fee': 'رسوم الاشتراك الثابتة',
    'Reserved volume': 'الحجم المحجوز',
    'm³': 'م³',
    'Snapshotted at': 'تاريخ اللقطة',
    'Line items & charges': 'البنود والرسوم',
    'Fixed subscription': 'الاشتراك الثابت',
    Subtotal: 'المجموع الفرعي',
    Discount: 'الخصم',
    Taxes: 'الضرائب',
    'Grand total': 'الإجمالي',
    'Payment information': 'معلومات الدفع',
    'Payment date': 'تاريخ الدفع',
    'Invoice timeline': 'الجدول الزمني للفاتورة',
    'Invoice created': 'إنشاء الفاتورة',
    'Invoice issued': 'إصدار الفاتورة',
    'Payment due': 'استحقاق الدفع',
    'Marked paid': 'تم التسديد',
  };
  return ar[label] ?? label;
}

function ChargeRow({ label, amount, emphasize }: { label: string; amount: string; emphasize?: boolean }) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 py-2.5',
        emphasize
          ? 'mt-2 border-t-2 border-[var(--border-strong)] pt-3 font-semibold'
          : 'border-b border-[var(--border-subtle)]',
      ].join(' ')}
    >
      <span className={emphasize ? 'text-[var(--text-strong)]' : 'text-sm text-[var(--text-base)]'}>
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-[var(--text-strong)]" dir="ltr">
        {formatDecimal(amount)} {CURRENCY}
      </span>
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <li className="relative pl-5 pb-4 last:pb-0">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-brand-50 dark:ring-white/5" />
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-sm font-medium text-text-strong mt-0.5">{value}</div>
    </li>
  );
}

export function BillingInvoiceDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isArabic = isClientArabic();
  const t = (label: string) => detailLabel(label, isArabic);
  const shouldPrint = searchParams.get('print') === '1';

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'billing', 'invoices', id],
    queryFn: () => fetchClientInvoice(id),
    enabled: !!id,
  });

  const breakdown = useQuery({
    queryKey: ['client-invoice-breakdown', id],
    queryFn: () => fetchClientInvoiceBreakdown(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (!shouldPrint || !data || isLoading) return;
    const timer = window.setTimeout(() => {
      window.print();
      const next = new URLSearchParams(searchParams);
      next.delete('print');
      setSearchParams(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [shouldPrint, data, isLoading, searchParams, setSearchParams]);

  const notFound = error && isAxiosError(error) && error.response?.status === 404;
  const snapshot = parseRateSnapshot(data?.billingCycle?.rateSnapshot);
  const lines = data?.lines ?? [];
  const cycle = data?.billingCycle;
  const paymentDate =
    data?.status === 'paid' ? formatDate(data.updatedAt) : '—';

  return (
    <ClientDetailShell
      backTo="/invoices"
      backLabel={t('Back to invoices')}
      loading={isLoading}
      loadingLabel={t('Loading invoice…')}
      notFound={!!notFound}
      notFoundTitle={t('Invoice not found')}
      notFoundDescription={t('This invoice is missing or you do not have access.')}
      errorTitle={!notFound && error ? t('Could not load this invoice') : null}
      errorDescription={t('Please try again.')}
      title={
        data ? (
          <span>
            {t('Invoice')}{' '}
            <span className="font-mono" dir="ltr">
              {data.invoiceNumber}
            </span>
          </span>
        ) : undefined
      }
      status={
        data ? (
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <span className={invoiceStatusClass(data.status)}>
              {humanizeInvoiceStatus(data.status)}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-body bg-surface-sunken hover:bg-surface-hover border border-border-strong transition-colors"
            >
              <i className="fa-solid fa-print" />
              {t('Print')}
            </button>
          </div>
        ) : undefined
      }
    >
      {data ? (
        <>
          <DetailSection title={t('Summary')}>
            <DetailGrid>
              <DetailField label={t('Billing period')}>{formatCycleLabel(cycle)}</DetailField>
              <DetailField label={t('Invoice date')}>
                {formatDate(data.issuedAt ?? data.createdAt)}
              </DetailField>
              <DetailField label={t('Due date')}>{formatDate(data.dueDate)}</DetailField>
              <DetailField label={t('Created')}>{formatDate(data.createdAt)}</DetailField>
              <DetailField label={t('Amount')}>
                {formatDecimal(data.grandTotal ?? data.totalAmount)} {CURRENCY}
              </DetailField>
              <DetailField label={t('Currency')}>{CURRENCY}</DetailField>
              <DetailField label={t('Payment status')}>
                {humanizeInvoiceStatus(data.status)}
              </DetailField>
            </DetailGrid>
          </DetailSection>

          <DetailSection title={t('Billing plan snapshot')}>
            {snapshot ? (
              <DetailGrid>
                <DetailField label={t('Fixed subscription fee')}>
                  {formatDecimal(snapshot.fixedSubscriptionFee)} {CURRENCY}
                </DetailField>
                <DetailField label={t('Reserved volume')}>
                  {formatDecimal(snapshot.reservedVolume, 4)} {t('m³')}
                </DetailField>
                {snapshot.snapshottedAt ? (
                  <DetailField label={t('Snapshotted at')}>
                    {formatDate(snapshot.snapshottedAt)}
                  </DetailField>
                ) : null}
              </DetailGrid>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                {t('No rate snapshot for this billing cycle.')}
              </p>
            )}
          </DetailSection>

          {breakdown.data && breakdown.data.sections.some((sec) => sec.orderCount > 0) ? (
            <DetailSection title={t('Orders on this invoice')}>
              <div className="space-y-5">
                {breakdown.data.sections
                  .filter((sec) => sec.orderCount > 0)
                  .map((sec) => (
                    <div key={sec.kind} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold">
                          {sec.kind === 'inbound' ? t('Inbound orders') : sec.kind === 'outbound' ? t('Outbound orders') : t('Online orders')} ({sec.orderCount})
                        </h4>
                        {Object.entries(sec.statusCounts).map(([status, n]) => (
                          <span key={status} className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                            {status.replace(/_/g, ' ')}: {n}
                          </span>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
                              <th className="px-2 py-2">{t('Order')}</th>
                              <th className="px-2 py-2">{t('Status')}</th>
                              {sec.billed ? <th className="px-2 py-2 text-right">{t('Fulfillment')}</th> : null}
                              {sec.kind === 'oms' ? <th className="px-2 py-2 text-right">{t('Shipping fee')}</th> : null}
                            </tr>
                          </thead>
                          <tbody>
                            {sec.orders.map((o) => (
                              <tr key={`${sec.kind}-${o.orderNumber}`} className="border-b border-[var(--border-subtle)]/60">
                                <td className="px-2 py-2 font-mono">{o.orderNumber}</td>
                                <td className="px-2 py-2">{o.status.replace(/_/g, ' ')}</td>
                                {sec.billed ? <td className="px-2 py-2 text-right">{o.charged && o.fulfillmentFee != null ? `$${o.fulfillmentFee}` : '—'}</td> : null}
                                {sec.kind === 'oms' ? (
                                  <td className="px-2 py-2 text-right">
                                    {o.shippingFee == null ? '—' : `$${o.shippingFee}${o.shippingFeeAlreadySettled ? ` (${t('already deducted')})` : ''}`}
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                          {sec.billed || sec.shippingTotal ? (
                            <tfoot>
                              <tr className="font-semibold">
                                <td className="px-2 py-2" colSpan={2}>{t('Total')}</td>
                                {sec.billed ? <td className="px-2 py-2 text-right">${sec.fulfillmentTotal}</td> : null}
                                {sec.kind === 'oms' ? <td className="px-2 py-2 text-right">{sec.shippingTotal ? `$${sec.shippingTotal}` : '—'}</td> : null}
                              </tr>
                            </tfoot>
                          ) : null}
                        </table>
                      </div>
                    </div>
                  ))}
                {breakdown.data.statement ? (
                  <p className="rounded-lg bg-[var(--surface-raised)] p-3 text-sm">
                    {t('Balance before')} ${breakdown.data.statement.balanceBefore} · {t('deducted')} ${breakdown.data.statement.deducted} · {t('balance after')} ${breakdown.data.statement.balanceAfter}
                    {Number(breakdown.data.statement.remainingDue) > 0 ? ` · ${t('still due')} $${breakdown.data.statement.remainingDue}` : ` · ${t('fully settled')}`}
                  </p>
                ) : null}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection title={t('Line items & charges')}>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]/50 px-4 py-1">
              <ChargeRow label={t('Fixed subscription')} amount={lineTotalByType(lines, 'subscription')} />
              {lines
                .filter(
                  (l) =>
                    l.lineSource === 'manual' ||
                    l.lineSource === 'order' ||
                    l.type === 'manual' ||
                    l.type === 'order_charge' ||
                    l.type === 'fulfillment_inbound' ||
                    l.type === 'fulfillment_outbound' ||
                    l.type === 'fulfillment_oms' ||
                    l.type === 'emdad_shipping' ||
                    l.type === 'storage_fee',
                )
                .map((line) => (
                  <ChargeRow
                    key={line.id}
                    label={line.description ?? line.type}
                    amount={line.totalPrice}
                  />
                ))}
              <ChargeRow label={t('Subtotal')} amount={data.subtotalAmount ?? data.totalAmount} />
              {Number(data.discountAmount ?? 0) > 0 ? (
                <ChargeRow label={t('Discount')} amount={`-${data.discountAmount}`} />
              ) : null}
              {Number(data.vatAmount ?? 0) > 0 ? (
                <ChargeRow
                  label={`${t('Taxes')} (${formatDecimal(data.vatPercentage ?? '0', 2)}%)`}
                  amount={data.vatAmount ?? '0'}
                />
              ) : null}
              <ChargeRow
                label={t('Grand total')}
                amount={data.grandTotal ?? data.totalAmount}
                emphasize
              />
            </div>
          </DetailSection>

          <DetailSection title={t('Payment information')}>
            <DetailGrid>
              <DetailField label={t('Payment status')}>
                {humanizeInvoiceStatus(data.status)}
              </DetailField>
              <DetailField label={t('Due date')}>{formatDate(data.dueDate)}</DetailField>
              <DetailField label={t('Payment date')}>{paymentDate}</DetailField>
              <DetailField label={t('Amount')}>
                {formatDecimal(data.grandTotal ?? data.totalAmount)} {CURRENCY}
              </DetailField>
              <DetailField label={t('Currency')}>{CURRENCY}</DetailField>
            </DetailGrid>
          </DetailSection>

          <DetailSection title={t('Invoice timeline')}>
            <ul className="border-l border-border ml-1.5 space-y-0">
              <TimelineItem label={t('Invoice created')} value={formatDate(data.createdAt)} />
              {data.issuedAt ? (
                <TimelineItem label={t('Invoice issued')} value={formatDate(data.issuedAt)} />
              ) : null}
              {data.dueDate ? (
                <TimelineItem label={t('Payment due')} value={formatDate(data.dueDate)} />
              ) : null}
              {data.status === 'paid' ? (
                <TimelineItem label={t('Marked paid')} value={paymentDate} />
              ) : null}
            </ul>
          </DetailSection>
        </>
      ) : null}
    </ClientDetailShell>
  );
}
