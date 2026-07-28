import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { CreateClientInboundModal } from '../components/CreateClientInboundModal';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientInboundOrder,
  fetchClientInboundOrders,
} from '../services/clientInboundOrdersService';

const INBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'partially_received', label: 'Partially received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound Orders': 'طلبات الوارد',
    'Manage and track your inbound orders': 'إدارة وتتبع طلبات الوارد الخاصة بك',
    'New inbound': 'وارد جديد',
    'Search order number...': 'ابحث برقم الطلب...',
    Filters: 'فلاتر',
    'All statuses': 'كل الحالات',
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
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const isArabic = isClientArabic();
  const t = (label: string) => inboundLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const debouncedSearch = useDebouncedValue(search, 300);

  const createMut = useMutation({
    mutationFn: createClientInboundOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'inbound-orders'] });
      setCreateError(null);
      setCreateOpen(false);
      navigate(`/inbound-orders/${order.id}`);
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
      fetchClientInboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'inbound-orders'],
    chunkQueryKeyPrefix: 'client-inbound-orders-chunk',
  });

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-arrow-down"
        title={t('Inbound Orders')}
        subtitle={t('Manage and track your inbound orders')}
        actions={
          <button
            type="button"
            disabled={!billingAccess.operationalAllowed}
            title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search order number...')}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm input-premium"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 input-premium"
            >
              {INBOUND_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.value === '' ? t('All statuses') : o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-filter text-xs" /> {t('Filters')}
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
              <tr>
                <th className="px-5 py-3 text-left w-10">
                  <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </th>
                <th className="px-5 py-3 text-left">{t('Order #')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-left">{t('Expected Arrival')}</th>
                <th className="px-5 py-3 text-left">{t('Lines')}</th>
                <th className="px-5 py-3 text-right">{t('Created')}</th>
                <th className="px-5 py-3 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.isInitialLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    …
                  </td>
                </tr>
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    {t('No inbound orders found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/inbound-orders/${row.id}`)}
                    className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 font-mono">
                      {row.orderNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(row.expectedArrivalDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{row._count?.lines ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center"
                      >
                        <i className="fa-solid fa-ellipsis" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
      </Card>

      <CreateClientInboundModal
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
