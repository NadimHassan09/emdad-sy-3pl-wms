import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

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
  fetchClientInvoicesPage,
  type ClientInvoice,
} from '../services/clientBillingService';

const INVOICE_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'unpaid', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CURRENCY = 'SYP';

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
  const [statusFilter, setStatusFilter] = useState('');

  const invoicePagination = useChunkedServerPagination<ClientInvoice>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]),
    fetchChunk: (offset, limit) =>
      fetchClientInvoicesPage({ offset, limit, status: statusFilter || undefined }),
    rtQueryKeyPrefix: ['client', 'billing', 'invoices'],
    chunkQueryKeyPrefix: 'client-billing-invoices-chunk',
  });

  function openInvoice(id: string): void {
    navigate(`/invoices/${id}`);
  }

  function printInvoice(id: string): void {
    navigate(`/invoices/${id}?print=1`);
  }

  return (
    <div className="space-y-5 animate-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <i className="fa-solid fa-file-invoice text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('Invoices')}</h1>
            <p className="text-xs text-slate-500">{t('Invoice history and payment status')}</p>
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 input-premium"
        >
          {INVOICE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === '' ? t('All statuses') : t(o.label)}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
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
            <tbody className="divide-y divide-slate-100">
              {invoicePagination.isInitialLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-400 text-sm">
                    …
                  </td>
                </tr>
              ) : invoicePagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-400 text-sm">
                    {statusFilter ? t('No invoices match this filter.') : t('No invoices yet.')}
                  </td>
                </tr>
              ) : (
                invoicePagination.rows.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => openInvoice(inv.id)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-900" dir="ltr">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {formatDate(inv.issuedAt ?? inv.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {formatCycleLabel(inv.billingCycle)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                      {formatDecimal(inv.grandTotal ?? inv.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{CURRENCY}</td>
                    <td className="px-5 py-3.5">
                      <Badge status={inv.status}>{humanizeInvoiceStatus(inv.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{paymentDateFor(inv)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={t('View')}
                          aria-label={t('View')}
                          onClick={() => openInvoice(inv.id)}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
                        >
                          <i className="fa-solid fa-eye text-xs" />
                        </button>
                        <button
                          type="button"
                          title={t('Print')}
                          aria-label={t('Print')}
                          onClick={() => printInvoice(inv.id)}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
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
