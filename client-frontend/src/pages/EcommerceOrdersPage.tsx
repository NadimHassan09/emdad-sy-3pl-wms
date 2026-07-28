import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { CreateClientOmsOrderModal } from '../components/CreateClientOmsOrderModal';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientOmsOrder,
  fetchClientOmsOrders,
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
    'Online, COD, and returns': 'الإلكتروني، الدفع عند الاستلام، والمرتجعات',
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
    'Create an order from your store channel to track fulfillment here.':
      'أنشئ طلباً من قناة متجرك لتتبع التنفيذ هنا.',
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

  const pagination = useChunkedServerPagination({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  });

  function openCreate() {
    setCreateError(null);
    setCreateOpen(true);
  }

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-cart-shopping"
        title={t('Online orders')}
        subtitle={t('Online, COD, and returns')}
        actions={
          <button
            type="button"
            disabled={!billingAccess.operationalAllowed}
            title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus text-xs" /> {t('Create order')}
          </button>
        }
      />

      <StorePillTabs isArabic={isArabic} />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load online orders')}>
          <Alert.Action variant="error" onClick={() => pagination.refetch()}>
            {t('Retry')}
          </Alert.Action>
        </Alert>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search order number...')}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm input-premium"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 input-premium"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.value === '' ? t('All statuses') : o.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">…</div>
        ) : pagination.rows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
              <i className="fa-solid fa-cart-shopping text-2xl text-slate-300" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{t('No online orders yet')}</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              {t('Create an order from your store channel to track fulfillment here.')}
            </p>
            {billingAccess.operationalAllowed ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                {t('Create first order')}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Order #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                    <th className="px-5 py-3 text-left">{t('Channel')}</th>
                    <th className="px-5 py-3 text-left">{t('Total')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/ecommerce-orders/${row.id}`)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900 font-mono">
                        {row.orderNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{row.recipientName || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{row.storeChannel || '—'}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {row.total == null
                          ? '—'
                          : `${row.total}${row.currency ? ` ${row.currency}` : ''}`}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
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
