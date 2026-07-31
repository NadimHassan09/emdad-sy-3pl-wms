import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert, Button, EmptyState, ListPageHeader, Skeleton } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { CreateClientOmsOrderModal } from '../components/CreateClientOmsOrderModal';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientOmsOrder,
  fetchClientOmsOrders,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
} from '../services/clientOmsOrdersService';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'picking', label: 'Picking' },
  { value: 'packing', label: 'Packing' },
  { value: 'ready_to_ship', label: 'Ready to ship' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed_delivery', label: 'Failed delivery' },
  { value: 'completed', label: 'Completed' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Online orders': 'الطلبات الإلكترونية',
    'Orders from your store channels': 'طلبات من قنوات متجرك',
    'Create order': 'إنشاء طلب',
    'Search order number...': 'ابحث برقم الطلب...',
    'All statuses': 'كل الحالات',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    Recipient: 'المستلم',
    Channel: 'القناة',
    Total: 'الإجمالي',
    Created: 'تاريخ الإنشاء',
    'No online orders yet': 'لا توجد طلبات إلكترونية بعد',
    'Create an order from your store channel to track it here.':
      'أنشئ طلباً من قناة متجرك لتتبعه هنا.',
    'No online orders match the filters.': 'لا توجد طلبات إلكترونية مطابقة للفلاتر.',
    'Create first order': 'إنشاء أول طلب',
    'Could not load online orders': 'تعذر تحميل الطلبات الإلكترونية',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

export function EcommerceOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const debouncedSearch = useDebouncedValue(search, 300);

  const createMut = useMutation({
    mutationFn: createClientOmsOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
      setCreateError(null);
      setCreateOpen(false);
      navigate(`/ecommerce-orders/${order.id}`);
    },
    onError: (err: Error) => setCreateError(err.message || 'Could not submit order.'),
  });

  const filterKey = useMemo(
    () => ({
      orderSearch: debouncedSearch.trim() || undefined,
      status: (status || undefined) as ClientOmsOrderStatus | undefined,
    }),
    [debouncedSearch, status],
  );

  const pagination = useChunkedServerPagination<ClientOmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  });

  const hasActiveFilters = Boolean(debouncedSearch.trim() || status);

  function openCreate() {
    setCreateError(null);
    setCreateOpen(true);
  }

  const createButton = (
    <Button
      variant="primary"
      size="md"
      disabled={!billingAccess.operationalAllowed}
      title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
      onClick={openCreate}
      startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
    >
      {t('Create order')}
    </Button>
  );

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-cart-shopping"
        title={t('Online orders')}
        subtitle={t('Orders from your store channels')}
        actions={createButton}
      />

      <StorePillTabs isArabic={isArabic} />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load online orders')}>
          <Alert.Action variant="error" onClick={() => pagination.refetch()}>
            {t('Retry')}
          </Alert.Action>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-xs" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search order number...')}
            className="w-full pl-9 pr-4 py-2 bg-surface-panel border border-border-strong text-text-strong placeholder:text-text-faint rounded-lg text-sm input-premium focus-visible:outline-none focus-visible:shadow-focus"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 bg-surface-panel border border-border-strong rounded-lg text-sm text-text-body input-premium focus-visible:outline-none focus-visible:shadow-focus"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.value === '' ? t('All statuses') : o.label}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                <tr>
                  <th className="px-5 py-3 text-left">{t('Order #')}</th>
                  <th className="px-5 py-3 text-left">{t('Status')}</th>
                  <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                  <th className="px-5 py-3 text-left">{t('Channel')}</th>
                  <th className="px-5 py-3 text-left">{t('Total')}</th>
                  <th className="px-5 py-3 text-right">{t('Created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`sk-${rowIdx}`}>
                    {Array.from({ length: 6 }).map((__, colIdx) => (
                      <td key={colIdx} className="px-5 py-3.5">
                        <Skeleton height={14} width={colIdx === 0 ? '70%' : '55%'} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : pagination.rows.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-cart-shopping text-2xl" aria-hidden="true" />}
            title={
              hasActiveFilters ? t('No online orders match the filters.') : t('No online orders yet')
            }
            description={
              hasActiveFilters
                ? undefined
                : t('Create an order from your store channel to track it here.')
            }
            action={
              !hasActiveFilters && billingAccess.operationalAllowed ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={openCreate}
                  startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
                >
                  {t('Create first order')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Order #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                    <th className="px-5 py-3 text-left">{t('Channel')}</th>
                    <th className="px-5 py-3 text-left">{t('Total')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(pagination.rows as ClientOmsOrderListItem[]).map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/ecommerce-orders/${row.id}`)}
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                        {row.orderNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-text-body">{row.recipientName || '—'}</td>
                      <td className="px-5 py-3.5 text-text-body">{row.storeChannel || '—'}</td>
                      <td className="px-5 py-3.5 font-medium text-text-strong">
                        {row.total == null
                          ? '—'
                          : `${row.total}${row.currency ? ` ${row.currency}` : ''}`}
                      </td>
                      <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
          </>
        )}
      </Card>

      <CreateClientOmsOrderModal
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
