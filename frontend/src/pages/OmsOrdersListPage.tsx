import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card } from '@ds';
import type { OmsOrderListItem, OmsOrderStatus } from '../api/oms';
import { OmsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { OMS_COMMERCIAL_FILTER_OPTIONS } from '../lib/oms-commercial-status';
import { useDebounced } from '../lib/useDebounced';

const OMS_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...OMS_COMMERCIAL_FILTER_OPTIONS.filter((o) => o.value !== ''),
];

export function OmsOrdersListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');

  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null);

  const editDetailQuery = useQuery({
    queryKey: [...QK.omsOrders, editOrderId],
    queryFn: () => OmsApi.getOrder(editOrderId!),
    enabled: !!editOrderId,
  });

  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters({
    orderSearch: '',
    status: '',
  });

  const debouncedSearch = useDebounced(draftFilters.orderSearch, 300);

  useEffect(() => {
    if ((debouncedSearch ?? '') === (appliedFilters.orderSearch ?? '')) return;
    applyPatch({ orderSearch: debouncedSearch ?? '' });
  }, [debouncedSearch, appliedFilters.orderSearch, applyPatch]);

  const listParams = useMemo(
    () => ({
      status: (appliedFilters.status.trim() || undefined) as OmsOrderStatus | undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<OmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsOrders,
    chunkQueryKeyPrefix: 'oms-orders-chunk',
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => OmsApi.delete(id),
    onSuccess: () => {
      toast.success('E-commerce order deleted.');
      setDeleteOrder(null);
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<OmsOrderListItem>[] = [
    {
      header: 'Order #',
      accessor: (row) => <span className="font-medium text-text-strong">{row.orderNumber}</span>,
    },
    {
      header: 'Client',
      accessor: (row) => row.company?.name?.trim() || '—',
    },
    {
      header: 'Customer',
      accessor: (row) => row.recipientName?.trim() || '—',
    },
    {
      header: 'Phone',
      accessor: (row) => row.recipientPhone?.trim() || '—',
    },
    {
      header: 'City',
      accessor: (row) => row.city?.trim() || '—',
    },
    {
      header: 'Total',
      accessor: (row) =>
        row.total ? `${row.total}${row.currency ? ` ${row.currency}` : ''}` : '—',
    },
    {
      header: 'Status',
      accessor: (row) => <OmsStatusBadge status={row.status} isArabic={isArabic} />,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <RowActionsMenu
            ariaLabel="Open actions"
            items={[
              { key: 'edit', label: 'Edit', onClick: () => setEditOrderId(row.id) },
              ...(row.status === 'delivered' || row.status === 'completed'
                ? [
                    {
                      key: 'shippingFee',
                      label: 'Specify shipping fee',
                      onClick: () =>
                        navigate(`/orders/oms/${row.id}`, { state: { openShippingFee: true } }),
                    } as const,
                  ]
                : []),
              { key: 'delete', label: 'Delete', danger: true, onClick: () => setDeleteOrder(row) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-cart-shopping"
      title="OMS Orders"
      subtitle="Manage ecommerce and OMS fulfillment orders."
      isArabic={isArabic}
      actions={
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/orders/oms/new')}
          className={FILTER_PRIMARY_BUTTON_CLASS}
        >
          Create OMS Order
        </Button>
      }
    >
      <Card padding="md" className="mb-4">
        <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-72 sm:max-w-sm">
            <i
              className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
              aria-hidden
            />
            <input
              value={draftFilters.orderSearch}
              onChange={(e) => setDraft({ orderSearch: e.target.value })}
              placeholder={
                isArabic
                  ? 'بحث: رقم الطلب، العميل، الهاتف…'
                  : 'Search order #, customer, phone…'
              }
              aria-label={isArabic ? 'بحث' : 'Search'}
              className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken py-2 pl-9 pr-4 text-sm text-text-strong placeholder:text-text-faint"
            />
          </div>
          <select
            value={draftFilters.status}
            onChange={(e) => applyPatch({ status: e.target.value })}
            aria-label={isArabic ? 'الحالة' : 'Status'}
            className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm text-text-body sm:w-auto"
          >
            {OMS_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No OMS orders match the filters."
        onRowClick={(row) => navigate(`/orders/oms/${row.id}`)}
      />

      {editOrderId ? (
        <OmsOrderFormModal
          open
          mode="edit"
          initial={editDetailQuery.data ?? null}
          onClose={() => setEditOrderId(null)}
          onSaved={() => {
            setEditOrderId(null);
            void qc.invalidateQueries({ queryKey: QK.omsOrders });
          }}
        />
      ) : null}

      <ConfirmModal
        open={!!deleteOrder}
        title="Delete OMS order?"
        confirmLabel="Delete"
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOrder(null)}
        onConfirm={() => {
          if (deleteOrder) deleteMut.mutate(deleteOrder.id);
        }}
      >
        {deleteOrder
          ? `Delete ${deleteOrder.orderNumber}? This cannot be undone.`
          : null}
      </ConfirmModal>
    </AdminListPageShell>
  );
}
