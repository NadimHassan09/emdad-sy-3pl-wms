import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@ds';
import { CompaniesApi } from '../api/companies';
import type { OmsOrderListItem, OmsOrderStatus } from '../api/oms';
import { OmsApi } from '../api/oms';
import { useAuth } from '../auth/AuthContext';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel, FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { canAccessInternalTransfer } from '../lib/rbac';

type ListDraft = {
  orderSearch: string;
  companyId: string;
  status: string;
  storeChannel: string;
  linkStatus: string;
  createdFrom: string;
  createdTo: string;
};

const INITIAL: ListDraft = {
  orderSearch: '',
  companyId: '',
  status: '',
  storeChannel: '',
  linkStatus: '',
  createdFrom: '',
  createdTo: '',
};

export function OmsOrdersListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null);

  const editDetailQuery = useQuery({
    queryKey: [...QK.omsOrders, editOrderId],
    queryFn: () => OmsApi.getOrder(editOrderId!),
    enabled: !!editOrderId,
  });

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(INITIAL);

  const listParams = useMemo(
    () => ({
      companyId: appliedFilters.companyId || undefined,
      status: (appliedFilters.status.trim() || undefined) as OmsOrderStatus | undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      storeChannel: appliedFilters.storeChannel.trim() || undefined,
      linkStatus: (appliedFilters.linkStatus || undefined) as 'linked' | 'unlinked' | undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
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

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, 'All clients'),
    [companies.data],
  );

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
      accessor: (row) => <span className="font-medium text-slate-900">{row.orderNumber}</span>,
    },
    {
      header: 'Customer',
      accessor: (row) => row.company?.name ?? row.recipientName ?? '—',
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Sales Channel',
      accessor: (row) => row.storeChannel ?? '—',
    },
    {
      header: 'Total',
      accessor: (row) =>
        row.total ? `${row.total}${row.currency ? ` ${row.currency}` : ''}` : '—',
    },
    {
      header: 'Linked Outbound Order',
      accessor: (row) =>
        row.linkedOutboundOrder ? (
          <Link
            to={`/orders/outbound/${row.linkedOutboundOrder.id}`}
            className="text-emerald-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.linkedOutboundOrder.orderNumber}
          </Link>
        ) : (
          <span className="text-slate-500">Not Linked</span>
        ),
    },
    {
      header: 'Created At',
      accessor: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      header: 'Updated At',
      accessor: (row) => new Date(row.updatedAt).toLocaleString(),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <RowActionsMenu
            ariaLabel="Open actions"
            items={[
              { key: 'edit', label: 'Edit', onClick: () => setEditOrderId(row.id) },
              { key: 'delete', label: 'Delete', danger: true, onClick: () => setDeleteOrder(row) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="E-commerce order" />

      <FilterPanel title="Order filters" onApply={applyFilters} onReset={resetFilters}>
        <TextField
          label="Search"
          value={draftFilters.orderSearch}
          onChange={(e) => setDraft({ orderSearch: e.target.value })}
          placeholder="Search order…"
        />
        {isAdmin ? (
          <Combobox
            label="Client"
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={clientFilterOptions}
            placeholder="All clients"
          />
        ) : null}
        <SelectField
          label="Status"
          name="omsStatusFilter"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'processing', label: 'Processing' },
            { value: 'allocated', label: 'Allocated' },
            { value: 'out_for_delivery', label: 'Out for delivery' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <TextField
          label="Sales channel"
          value={draftFilters.storeChannel}
          onChange={(e) => setDraft({ storeChannel: e.target.value })}
        />
        <SelectField
          label="Warehouse link"
          name="omsWarehouseLinkFilter"
          value={draftFilters.linkStatus}
          onChange={(e) => setDraft({ linkStatus: e.target.value })}
          options={[
            { value: '', label: 'All' },
            { value: 'linked', label: 'Linked' },
            { value: 'unlinked', label: 'Not linked' },
          ]}
        />
        <TextField
          label="Created from"
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
        />
        <TextField
          label="Created to"
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
        />
      </FilterPanel>

      <DataTable
        title="E-commerce order"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateOpen(true)}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            Create E-commerce Order
          </Button>
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        onRowClick={(row) => navigate(`/orders/oms/${row.id}`)}
        empty="No e-commerce orders match the filters."
      />

      <OmsOrderFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
      />

      <OmsOrderFormModal
        open={!!editOrderId}
        mode="edit"
        initial={editDetailQuery.data ?? null}
        onClose={() => setEditOrderId(null)}
        onSaved={() => {
          setEditOrderId(null);
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
      />

      <ConfirmModal
        open={!!deleteOrder}
        title="Delete this e-commerce order?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOrder(null)}
        onConfirm={() => deleteOrder && deleteMut.mutate(deleteOrder.id)}
      >
        <p className="text-sm">
          This removes only the OMS record. Any linked outbound order will not be deleted.
        </p>
      </ConfirmModal>
    </div>
  );
}
