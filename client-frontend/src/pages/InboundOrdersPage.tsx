import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import {
  clientInboundStatusLabel,
  mapClientInboundDisplayStatus,
} from '../lib/client-inbound-status';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientInboundOrders } from '../services/clientInboundOrdersService';

const INBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound Orders': 'طلبات الوارد',
    'Manage and track your inbound orders': 'إدارة وتتبع طلبات الوارد الخاصة بك',
    'Warehouse receipts': 'إيصالات المستودع',
    'New inbound': 'وارد جديد',
    'Search order number...': 'ابحث برقم الطلب...',
    Filters: 'فلاتر',
    'All statuses': 'كل الحالات',
    'Waiting for approval': 'بانتظار الموافقة',
    'In progress': 'قيد التنفيذ',
    Completed: 'مكتمل',
    Cancelled: 'ملغي',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    'Expected Arrival': 'الوصول المتوقع',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    Actions: 'الإجراءات',
    'No inbound orders found.': 'لا توجد طلبات وارد.',
    'Could not load inbound orders': 'تعذر تحميل طلبات الوارد',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

export function InboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const isArabic = isClientArabic();
  const t = (label: string) => inboundLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const debouncedSearch = useDebouncedValue(search, 300);

  const filterKey = useMemo(
    () => ({ orderSearch: debouncedSearch.trim() || undefined, status: status || undefined }),
    [debouncedSearch, status],
  );

  const pagination = useChunkedServerPagination({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) =>
      fetchClientInboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'inbound-orders'],
    chunkQueryKeyPrefix: 'client-inbound-orders-chunk',
  });

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-arrow-down"
        title={t('Inbound Orders')}
        subtitle={t('Warehouse receipts')}
        actions={
          <button
            type="button"
            disabled={!billingAccess.operationalAllowed}
            title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
            onClick={() => navigate('/inbound-orders/new')}
            className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-medium hover:bg-cta-hover transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus text-xs" /> {t('New inbound')}
          </button>
        }
      />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load inbound orders')}>
          <Alert.Action variant="error" onClick={() => pagination.refetch()}>
            {t('Retry')}
          </Alert.Action>
        </Alert>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search order number...')}
              className="w-full pl-9 pr-4 py-2 bg-surface-sunken border border-border-strong text-text-strong placeholder:text-text-faint rounded-lg text-sm input-premium"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t('All statuses')}
              className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
            >
              {INBOUND_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.value === '' ? t('All statuses') : o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t('Order #')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-left">{t('Expected Arrival')}</th>
                <th className="px-5 py-3 text-left">{t('Lines')}</th>
                <th className="px-5 py-3 text-right">{t('Created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3.5" colSpan={5}>
                      <div className="h-4 w-full max-w-xl rounded bg-skeleton-base" />
                    </td>
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-faint text-sm">
                    {t('No inbound orders found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/inbound-orders/${row.id}`)}
                    className="hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                      {row.orderNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={mapClientInboundDisplayStatus(row.status)}>
                        {clientInboundStatusLabel(row.status, isArabic)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-text-body">
                      {new Date(row.expectedArrivalDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-text-body">{row._count?.lines ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
      </Card>
    </div>
  );
}
