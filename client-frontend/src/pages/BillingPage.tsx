import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Alert } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { isClientArabic } from '../lib/client-ui-language';
import {
  accountStatusClass,
  accountStatusLabel,
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
  isCurrentCycleInvoice,
} from '../lib/billing-display';
import {
  fetchClientBillingSummary,
  fetchClientInvoicesPage,
  type ClientInvoice,
} from '../services/clientBillingService';

function billingLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Billing: 'الفوترة',
    'Account status': 'حالة الحساب',
    Active: 'نشط',
    Expiring: 'ينتهي قريبًا',
    Restricted: 'مقيّد',
    'Your billing cycle is ending soon. Contact your account manager to renew.':
      'دورة الفوترة تنتهي قريبًا. تواصل مع مدير حسابك للتجديد.',
    'Your account is restricted due to an expired billing cycle. Contact finance to restore access.':
      'حسابك مقيّد بسبب انتهاء دورة الفوترة. تواصل مع المالية لاستعادة الوصول.',
    'Current billing plan': 'خطة الفوترة الحالية',
    'No active billing plan on file.': 'لا توجد خطة فوترة نشطة.',
    'Cycle length': 'مدة الدورة',
    days: 'يوم',
    'Fixed subscription fee': 'رسوم الاشتراك الثابتة',
    'Current cycle': 'الدورة الحالية',
    'Days remaining': 'الأيام المتبقية',
    'Reserved volume': 'الحجم المحجوز',
    'Reserved weight': 'الوزن المحجوز',
    CBM: 'م³',
    kg: 'كغ',
    'Current invoice': 'الفاتورة الحالية',
    'No invoice for the current billing cycle yet.': 'لا توجد فاتورة للدورة الحالية بعد.',
    'View invoice': 'عرض الفاتورة',
    'Invoice history': 'سجل الفواتير',
    'No invoices yet.': 'لا توجد فواتير بعد.',
    'Could not load billing': 'تعذر تحميل الفوترة',
    'Invoice #': 'رقم الفاتورة',
    Cycle: 'الدورة',
    Amount: 'المبلغ',
    Status: 'الحالة',
    Created: 'تاريخ الإنشاء',
    Current: 'الحالية',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
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

export function BillingPage(): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => billingLabel(label, isArabic);

  const summaryQuery = useQuery({
    queryKey: ['client', 'billing', 'summary'],
    queryFn: fetchClientBillingSummary,
  });

  const invoicePagination = useChunkedServerPagination<ClientInvoice>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: useMemo(() => ({}), []),
    fetchChunk: (offset, limit) => fetchClientInvoicesPage({ offset, limit }),
    rtQueryKeyPrefix: ['client', 'billing', 'invoices'],
    chunkQueryKeyPrefix: 'client-billing-invoices-chunk',
  });

  const summary = summaryQuery.data;
  const currentCycleId = summary?.currentCycle?.id;

  const tableLabels = {
    rowsSuffix: t('rows'),
    resultsSuffix: t('results'),
    ofWord: t('of'),
    previous: t('Previous'),
    next: t('Next'),
    rowsPerPageAria: t('Rows per page'),
  };

  const columns: Column<ClientInvoice>[] = [
    {
      header: t('Invoice #'),
      accessor: (row) => (
        <span className="font-mono" dir="ltr">
          {row.invoiceNumber}
        </span>
      ),
      width: '140px',
    },
    {
      header: t('Cycle'),
      accessor: (row) => formatCycleLabel(row.billingCycle),
    },
    {
      header: t('Amount'),
      accessor: (row) => formatDecimal(row.totalAmount),
      width: '100px',
    },
    {
      header: t('Status'),
      accessor: (row) => (
        <span className={invoiceStatusClass(row.status)}>{humanizeInvoiceStatus(row.status)}</span>
      ),
      className: 'w-1 whitespace-nowrap',
    },
    {
      header: t('Created'),
      accessor: (row) => formatDate(row.createdAt),
      width: '120px',
    },
    {
      header: '',
      accessor: (row) =>
        isCurrentCycleInvoice(row, currentCycleId) ? (
          <span className="badge badge-progress">{t('Current')}</span>
        ) : null,
      width: '90px',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="card__title">{t('Billing')}</h1>

        {summaryQuery.isError ? (
          <Alert variant="error" title={t('Could not load billing')} className="mb-4" />
        ) : null}

        {summaryQuery.isPending ? (
          <p className="muted">Loading billing…</p>
        ) : summary ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <span className="muted">{t('Account status')}</span>
              <span className={accountStatusClass(summary.accountStatus)}>
                {t(accountStatusLabel(summary.accountStatus))}
              </span>
            </div>

            {summary.accountStatus === 'expiring' ? (
              <p className="banner banner--warn" role="status" style={{ marginBottom: '1rem' }}>
                {t(
                  'Your billing cycle is ending soon. Contact your account manager to renew.',
                )}
              </p>
            ) : null}

            {summary.accountStatus === 'restricted' ? (
              <p className="banner banner--error" role="alert" style={{ marginBottom: '1rem' }}>
                {t(
                  'Your account is restricted due to an expired billing cycle. Contact finance to restore access.',
                )}
              </p>
            ) : null}

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Current billing plan')}</h2>
              {summary.plan ? (
                <dl className="details">
                  <DetailRow
                    label={t('Fixed subscription fee')}
                    value={formatDecimal(summary.plan.fixedSubscriptionFee)}
                  />
                  <DetailRow
                    label={t('Cycle length')}
                    value={`${summary.plan.cycleLengthDays} ${t('days')}`}
                  />
                  <DetailRow
                    label={t('Reserved volume')}
                    value={`${formatDecimal(summary.reservedVolume, 4)} ${t('CBM')}`}
                  />
                  <DetailRow
                    label={t('Reserved weight')}
                    value={`${formatDecimal(summary.reservedWeight, 4)} ${t('kg')}`}
                  />
                </dl>
              ) : (
                <p className="muted">{t('No active billing plan on file.')}</p>
              )}
            </section>

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Current cycle')}</h2>
              {summary.currentCycle ? (
                <dl className="details">
                  <DetailRow label={t('Current cycle')} value={formatCycleLabel(summary.currentCycle)} />
                  <DetailRow
                    label={t('Days remaining')}
                    value={
                      summary.daysRemaining != null ? String(Math.max(0, summary.daysRemaining)) : '—'
                    }
                  />
                </dl>
              ) : (
                <p className="muted">—</p>
              )}
            </section>

            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="card__subtitle">{t('Current invoice')}</h2>
              {summary.currentInvoice ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                  <span className="font-mono" dir="ltr">
                    {summary.currentInvoice.invoiceNumber}
                  </span>
                  <span className={invoiceStatusClass(summary.currentInvoice.status)}>
                    {humanizeInvoiceStatus(summary.currentInvoice.status)}
                  </span>
                  <span>{formatDecimal(summary.currentInvoice.totalAmount)}</span>
                  <Link to={`/billing/invoices/${summary.currentInvoice.id}`}>
                    {t('View invoice')}
                  </Link>
                </div>
              ) : (
                <p className="muted">{t('No invoice for the current billing cycle yet.')}</p>
              )}
            </section>

            <section>
              <h2 className="card__subtitle">{t('Invoice history')}</h2>
              <DataTable
                columns={columns}
                rows={invoicePagination.rows}
                rowKey={(row) => row.id}
                loading={invoicePagination.isInitialLoading}
                onRowClick={(row) => navigate(`/billing/invoices/${row.id}`)}
                empty={t('No invoices yet.')}
                serverPagination={invoicePagination.serverPagination}
                labels={tableLabels}
              />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
