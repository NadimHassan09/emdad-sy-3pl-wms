import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { CreateClientOutboundModal } from '../components/CreateClientOutboundModal';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientOutboundOrder,
  fetchClientOutboundOrders,
} from '../services/clientOutboundOrdersService';

const OUTBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'picking', label: 'Picking' },
  { value: 'packing', label: 'Packing' },
  { value: 'ready_to_ship', label: 'Ready to ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Cancelled' },
];

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound Orders': 'طلبات الصادر',
    'Manage and track your outbound orders': 'إدارة وتتبع طلبات الصادر الخاصة بك',
    'Warehouse shipments': 'شحنات المستودع',
    'New outbound': 'صادر جديد',
    'Search order number...': 'ابحث برقم الطلب...',
    Filters: 'فلاتر',
    'All statuses': 'كل الحالات',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    Recipient: 'المستلم',
    'Required Ship': 'الشحن المطلوب',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    Actions: 'الإجراءات',
    'No outbound orders found.': 'لا توجد طلبات صادر.',
    'Could not load outbound orders': 'تعذر تحميل طلبات الصادر',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

export function OutboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const isArabic = isClientArabic();
  const t = (label: string) => outboundLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const debouncedSearch = useDebouncedValue(search, 300);

  const createMut = useMutation({
    mutationFn: createClientOutboundOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'outbound-orders'] });
      setCreateError(null);
      setCreateOpen(false);
      navigate(`/outbound-orders/${order.id}`);
    },
    onError: (err: Error) => setCreateError(err.message || 'Could not submit order.'),
  });

  const filterKey = useMemo(
    () => ({ orderSearch: debouncedSearch.trim() || undefined, status: status || undefined }),
    [debouncedSearch, status],
  );

  const pagination = useChunkedServerPagination({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) =>
      fetchClientOutboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'outbound-orders'],
    chunkQueryKeyPrefix: 'client-outbound-orders-chunk',
  });

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-arrow-up"
        title={t('Outbound Orders')}
        subtitle={t('Warehouse shipments')}
        actions={
          <button
            type="button"
            disabled={!billingAccess.operationalAllowed}
            title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="px-4 py-2 bg-cta text-on-brand rounded-lg text-sm font-medium hover:bg-cta-hover transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus text-xs" /> {t('New outbound')}
          </button>
        }
      />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load outbound orders')}>
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
              {OUTBOUND_STATUS_OPTIONS.map((o) => (
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
                <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                <th className="px-5 py-3 text-left">{t('Required Ship')}</th>
                <th className="px-5 py-3 text-left">{t('Lines')}</th>
                <th className="px-5 py-3 text-right">{t('Created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3.5" colSpan={6}>
                      <div className="h-4 w-full max-w-xl rounded bg-skeleton-base" />
                    </td>
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-text-faint text-sm">
                    {t('No outbound orders found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/outbound-orders/${row.id}`)}
                    className="hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                      {row.orderNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 text-text-body">{row.recipientName || '—'}</td>
                    <td className="px-5 py-3.5 text-text-body">
                      {row.requiredShipDate
                        ? new Date(row.requiredShipDate).toLocaleDateString()
                        : '—'}
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

      <CreateClientOutboundModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        submitError={createError}
        onSubmit={(input) => {
          setCreateError(null);
          createMut.mutate(input);
        }}
        isArabic={isArabic}
      />
    </div>
  );
}
