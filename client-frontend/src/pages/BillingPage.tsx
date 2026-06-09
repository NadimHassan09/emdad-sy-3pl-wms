import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Alert, EmptyState } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FilterPanel } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';
import { useFilters } from '@wms/hooks/useFilters';

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

const INVOICE_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

type InvoiceListDraft = { status: string };

const statCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4';

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
    'No invoices match this filter.': 'لا توجد فواتير تطابق هذا الفلتر.',
    'Invoices are generated at the end of each billing cycle.':
      'تُنشأ الفواتير في نهاية كل دورة فوترة.',
    'Could not load billing': 'تعذر تحميل الفوترة',
    'Invoice #': 'رقم الفاتورة',
    Cycle: 'الدورة',
    Amount: 'المبلغ',
    Status: 'الحالة',
    Issued: 'تاريخ الإصدار',
    Created: 'تاريخ الإنشاء',
    Current: 'الحالية',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'Invoice filters': 'فلاتر الفواتير',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'All statuses': 'كل الحالات',
    Draft: 'مسودة',
    Open: 'مفتوحة',
    Paid: 'مدفوعة',
    Cancelled: 'ملغاة',
    'Days until renewal': 'أيام حتى التجديد',
    'Current invoice amount': 'مبلغ الفاتورة الحالية',
    'Total invoices': 'إجمالي الفواتير',
    'Contact your account manager to set up billing.':
      'تواصل مع مدير حسابك لإعداد الفوترة.',
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

function BillingStatWidget({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className={statCardClass}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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

  const initialFilters = useMemo<InvoiceListDraft>(() => ({ status: '' }), []);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

  const invoicePagination = useChunkedServerPagination<ClientInvoice>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: useMemo(
      () => ({ status: appliedFilters.status.trim() || undefined }),
      [appliedFilters.status],
    ),
    fetchChunk: (offset, limit) =>
      fetchClientInvoicesPage({
        offset,
        limit,
        status: appliedFilters.status.trim() || undefined,
      }),
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
      header: t('Issued'),
      accessor: (row) => formatDate(row.issuedAt),
      width: '120px',
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

  const statusOptions = INVOICE_STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.label === 'All statuses' ? 'All statuses' : opt.label),
  }));

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

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <BillingStatWidget
                title={t('Days until renewal')}
                value={
                  summary.daysRemaining != null
                    ? `${Math.max(0, summary.daysRemaining)} ${t('days')}`
                    : '—'
                }
              />
              <BillingStatWidget
                title={t('Current invoice amount')}
                value={
                  summary.currentInvoice
                    ? formatDecimal(summary.currentInvoice.totalAmount)
                    : '—'
                }
                hint={
                  summary.currentInvoice
                    ? summary.currentInvoice.invoiceNumber
                    : undefined
                }
              />
              <BillingStatWidget
                title={t('Total invoices')}
                value={String(invoicePagination.serverPagination.total)}
              />
            </div>

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
                <EmptyState
                  size="sm"
                  title={t('No active billing plan on file.')}
                  description={t('Contact your account manager to set up billing.')}
                />
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
                <EmptyState
                  size="sm"
                  title={t('No invoice for the current billing cycle yet.')}
                  description={t('Invoices are generated at the end of each billing cycle.')}
                />
              )}
            </section>

            <section>
              <h2 className="card__subtitle">{t('Invoice history')}</h2>

              <FilterPanel
                title={t('Invoice filters')}
                className="mb-4"
                onApply={applyFilters}
                onReset={resetFilters}
                loading={invoicePagination.isFetching}
                applyLabel={t('Apply filters')}
                resetLabel={t('Reset filters')}
              >
                <SelectField
                  label={t('Status')}
                  value={draftFilters.status}
                  options={statusOptions}
                  onChange={(e) => setDraft({ status: e.target.value })}
                />
              </FilterPanel>

              <DataTable
                columns={columns}
                rows={invoicePagination.rows}
                rowKey={(row) => row.id}
                loading={invoicePagination.isInitialLoading}
                onRowClick={(row) => navigate(`/billing/invoices/${row.id}`)}
                empty={
                  appliedFilters.status ? (
                    <EmptyState
                      size="sm"
                      title={t('No invoices match this filter.')}
                      secondaryAction={
                        <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                          {t('Reset filters')}
                        </button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="sm"
                      title={t('No invoices yet.')}
                      description={t('Invoices are generated at the end of each billing cycle.')}
                    />
                  )
                }
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
