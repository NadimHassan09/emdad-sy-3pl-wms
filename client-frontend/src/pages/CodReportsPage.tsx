import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useCachedState } from '../hooks/useCachedState';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientCodReport, type ClientCodReportRow } from '../services/clientOmsOrdersService';

const COD_STATUS_OPTIONS = [
  { value: '', label: 'All COD statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'collected', label: 'Collected' },
  { value: 'remitted', label: 'Remitted' },
  { value: 'settled', label: 'Settled' },
  { value: 'returned', label: 'Returned' },
];

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Cash on delivery': 'الدفع عند الاستلام',
    'Collected and pending remittance': 'المحصّل وبانتظار التحويل',
    'COD orders': 'طلبات الدفع عند الاستلام',
    'Total COD amount': 'إجمالي مبالغ التحصيل',
    'Matching filters': 'مطابق للفلاتر',
    'All COD statuses': 'كل حالات التحصيل',
    Pending: 'قيد الانتظار',
    Collected: 'محصّل',
    Remitted: 'محوّل',
    Settled: 'مسوّى',
    Returned: 'مرتجع',
    'From date': 'من تاريخ',
    'To date': 'إلى تاريخ',
    'Order #': 'رقم الطلب',
    Recipient: 'المستلم',
    Client: 'العميل',
    'COD amount': 'المبلغ',
    'COD status': 'الحالة',
    Created: 'تاريخ الإنشاء',
    'No cash-on-delivery orders': 'لا توجد طلبات دفع عند الاستلام',
    'COD orders will appear here once they are processed.': 'ستظهر طلبات الدفع عند الاستلام هنا عند معالجتها.',
  };
  return ar[label] ?? label;
}

export function CodReportsPage(): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);

  const [codStatus, setCodStatus] = useCachedState('codStatus', '');
  const [dateFrom, setDateFrom] = useCachedState('dateFrom', '');
  const [dateTo, setDateTo] = useCachedState('dateTo', '');

  const filterKey = useMemo(
    () => ({
      codStatus: codStatus || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [codStatus, dateFrom, dateTo],
  );

  const summaryQuery = useQuery({
    queryKey: ['client', 'cod-report', 'summary', filterKey],
    queryFn: () => fetchClientCodReport({ ...filterKey, offset: 0, limit: 1 }),
    select: (page) => page.summary,
  });

  const pagination = useChunkedServerPagination<ClientCodReportRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientCodReport({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'cod-report'],
    chunkQueryKeyPrefix: 'client-cod-report-chunk',
  });

  const summary = summaryQuery.data;
  const currencyHint = pagination.rows.find((r) => r.currency)?.currency;

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-money-bill"
        title={t('Cash on delivery')}
        subtitle={t('Collected and pending remittance')}
      />

      <StorePillTabs isArabic={isArabic} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6" hover>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted mb-4">
            <div className="w-6 h-6 rounded-md bg-brand-50 dark:bg-white/5 flex items-center justify-center">
              <i className="fa-solid fa-boxes-packing text-brand-600 dark:text-brand-400 text-xs" />
            </div>
            {t('COD orders')}
          </div>
          <div className="text-3xl font-bold text-text-strong">{summaryQuery.isPending ? '—' : (summary?.orderCount ?? 0)}</div>
          <div className="text-xs text-text-muted mt-1">{t('Matching filters')}</div>
        </Card>
        <Card className="p-6" hover>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted mb-4">
            <div className="w-6 h-6 rounded-md bg-status-warning-bg flex items-center justify-center">
              <i className="fa-solid fa-money-bill-wave text-status-warning-fg text-xs" />
            </div>
            {t('Total COD amount')}
          </div>
          <div className="text-3xl font-bold text-text-strong">
            {summaryQuery.isPending
              ? '—'
              : summary?.totalCodAmount != null
                ? `${summary.totalCodAmount}${currencyHint ? ` ${currencyHint}` : ''}`
                : '—'}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={codStatus}
            onChange={(e) => setCodStatus(e.target.value)}
            className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
          >
            {COD_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title={t('From date')}
            className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title={t('To date')}
            className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="px-5 py-10 text-center text-text-faint text-sm">…</div>
        ) : pagination.rows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-sunken flex items-center justify-center mb-4">
              <i className="fa-solid fa-money-bill text-2xl text-text-faint" />
            </div>
            <h3 className="text-base font-semibold text-text-strong">{t('No cash-on-delivery orders')}</h3>
            <p className="text-sm text-text-muted mt-1 max-w-xs">{t('COD orders will appear here once they are processed.')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Order #')}</th>
                    <th className="px-5 py-3 text-left">{t('Client')}</th>
                    <th className="px-5 py-3 text-left">{t('COD amount')}</th>
                    <th className="px-5 py-3 text-left">{t('COD status')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/ecommerce-orders/${row.id}`)}
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">{row.orderNumber}</td>
                      <td className="px-5 py-3.5 text-text-body">{row.recipientName ?? '—'}</td>
                      <td className="px-5 py-3.5 font-medium text-text-strong">
                        {row.codAmount != null ? `${row.codAmount}${row.currency ? ` ${row.currency}` : ''}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">{row.codStatus ? <Badge status={row.codStatus} /> : '—'}</td>
                      <td className="px-5 py-3.5 text-right text-text-muted text-xs">{new Date(row.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
          </>
        )}
      </Card>
    </div>
  );
}
