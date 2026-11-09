import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button, StatusCardNav, STATUS_CARD_TONES, type StatusCardItem } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useCachedState } from '../hooks/useCachedState';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
} from '../lib/billing-display';
import { isClientArabic } from '../lib/client-ui-language';
import {
  downloadClientInvoicesExcel,
  fetchClientInvoicesPage,
  type ClientInvoice,
} from '../services/clientBillingService';

const CURRENCY = 'USD';

function invoicesLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Invoices: 'الفواتير',
    'Invoice history and payment status': 'سجل الفواتير وحالة الدفع',
    'All statuses': 'كل الحالات',
    Pending: 'قيد الانتظار',
    Overdue: 'متأخر',
    Paid: 'مدفوعة',
    Draft: 'مسودة',
    Cancelled: 'ملغاة',
    'Export Excel': 'تصدير إكسل',
    Exporting: 'جاري التصدير...',
    'Invoice #': 'رقم الفاتورة',
    'Invoice date': 'تاريخ الفاتورة',
    'Billing period': 'فترة الفوترة',
    'Due date': 'تاريخ الاستحقاق',
    Amount: 'المبلغ',
    Currency: 'العملة',
    'Payment status': 'حالة الدفع',
    'Payment date': 'تاريخ الدفع',
    Actions: 'إجراءات',
    View: 'عرض',
    Print: 'طباعة',
    'No invoices yet.': 'لا توجد فواتير بعد.',
    'No invoices match this filter.': 'لا توجد فواتير تطابق هذا الفلتر.',
  };
  return ar[label] ?? label;
}

function paymentDateFor(invoice: ClientInvoice): string {
  // Backend does not expose a dedicated paidAt field.
  if (invoice.status !== 'paid') return '—';
  return formatDate(invoice.updatedAt);
}

export function InvoicesPage(): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => invoicesLabel(label, isArabic);
  const [statusFilter, setStatusFilter] = useCachedState('status', '');
  const [isExporting, setIsExporting] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['client', 'billing', 'invoices', 'summary'],
    queryFn: () => fetchClientInvoicesPage({ limit: 1 }),
  });
  const statusCounts = summaryQuery.data?.statusCounts ?? {};

  const invoicePagination = useChunkedServerPagination<ClientInvoice>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]),
    fetchChunk: (offset, limit) =>
      fetchClientInvoicesPage({ offset, limit, status: statusFilter || undefined }),
    rtQueryKeyPrefix: ['client', 'billing', 'invoices'],
    chunkQueryKeyPrefix: 'client-billing-invoices-chunk',
  });

  const statusItems: StatusCardItem[] = useMemo(
    () => [
      {
        value: '',
        label: t('All statuses'),
        count: statusCounts.all ?? invoicePagination.total,
        ...STATUS_CARD_TONES.slate,
      },
      {
        value: 'unpaid',
        label: t('Pending'),
        count: statusCounts.unpaid ?? 0,
        ...STATUS_CARD_TONES.amber,
      },
      {
        value: 'paid',
        label: t('Paid'),
        count: statusCounts.paid ?? 0,
        ...STATUS_CARD_TONES.emerald,
      },
      {
        value: 'draft',
        label: t('Draft'),
        count: statusCounts.draft ?? 0,
        ...STATUS_CARD_TONES.blue,
      },
      {
        value: 'cancelled',
        label: t('Cancelled'),
        count: statusCounts.cancelled ?? 0,
        ...STATUS_CARD_TONES.rose,
      },
    ],
    [statusCounts, invoicePagination.total, isArabic],
  );

  function openInvoice(id: string): void {
    navigate(`/invoices/${id}`);
  }

  function printInvoice(id: string): void {
    navigate(`/invoices/${id}?print=1`);
  }

  const handleExport = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      setIsExporting(true);
      await downloadClientInvoicesExcel(statusFilter || undefined, format);
    } catch (e) {
      console.error('Invoice export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5 animate-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-white/5 flex items-center justify-center">
            <i className="fa-solid fa-file-invoice text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-strong">{t('Invoices')}</h1>
            <p className="text-xs text-text-muted">{t('Invoice history and payment status')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('xlsx')}
            disabled={isExporting}
            startIcon={
              <i
                className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-excel'} text-emerald-600`}
                aria-hidden="true"
              />
            }
          >
            {isExporting ? t('Exporting') : t('Export Excel')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('csv')}
            disabled={isExporting}
            startIcon={<i className="fa-solid fa-file-csv" aria-hidden="true" />}
          >
            {isArabic ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <StatusCardNav
        items={statusItems}
        value={statusFilter}
        onChange={(val) => setStatusFilter(val)}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t('Invoice #')}</th>
                <th className="px-5 py-3 text-left">{t('Invoice date')}</th>
                <th className="px-5 py-3 text-left">{t('Billing period')}</th>
                <th className="px-5 py-3 text-left">{t('Due date')}</th>
                <th className="px-5 py-3 text-right">{t('Amount')}</th>
                <th className="px-5 py-3 text-left">{t('Currency')}</th>
                <th className="px-5 py-3 text-left">{t('Payment status')}</th>
                <th className="px-5 py-3 text-left">{t('Payment date')}</th>
                <th className="px-5 py-3 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {invoicePagination.isInitialLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-text-faint text-sm">
                    …
                  </td>
                </tr>
              ) : invoicePagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-text-faint text-sm">
                    {statusFilter ? t('No invoices match this filter.') : t('No invoices yet.')}
                  </td>
                </tr>
              ) : (
                invoicePagination.rows.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => openInvoice(inv.id)}
                    className="hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-text-strong" dir="ltr">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted text-xs">
                      {formatDate(inv.issuedAt ?? inv.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-text-body text-xs">
                      {formatCycleLabel(inv.billingCycle)}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted text-xs">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-text-strong">
                      {formatDecimal(inv.grandTotal ?? inv.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-text-body">{CURRENCY}</td>
                    <td className="px-5 py-3.5">
                      <Badge status={inv.status}>{humanizeInvoiceStatus(inv.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted text-xs">{paymentDateFor(inv)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={t('View')}
                          aria-label={t('View')}
                          onClick={() => openInvoice(inv.id)}
                          className="w-8 h-8 rounded-lg text-text-muted hover:bg-surface-hover hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
                        >
                          <i className="fa-solid fa-eye text-xs" />
                        </button>
                        <button
                          type="button"
                          title={t('Print')}
                          aria-label={t('Print')}
                          onClick={() => printInvoice(inv.id)}
                          className="w-8 h-8 rounded-lg text-text-muted hover:bg-surface-hover hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
                        >
                          <i className="fa-solid fa-print text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={invoicePagination.serverPagination} isArabic={isArabic} />
      </Card>
    </div>
  );
}
