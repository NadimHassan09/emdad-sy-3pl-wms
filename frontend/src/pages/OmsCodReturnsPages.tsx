import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@ds';
import type { CodRecord, CodRecordStatus, OmsReturn } from '../api/oms';
import { CodApi, OmsReturnsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { useToast } from '../components/ToastProvider';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';

function useIsArabic(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.localStorage.getItem('wms-ui-language') === 'AR' ||
    document.documentElement.dir === 'rtl'
  );
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—';
  return `${value}${currency ? ` ${currency}` : ''}`;
}

const COD_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'available', label: 'Available' },
  { value: 'paid_out', label: 'Paid out' },
];

const RETURN_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Standalone OMS COD page — not under Reporting Center. */
export function OmsCodPage() {
  const isArabic = useIsArabic();
  const toast = useToast();
  const qc = useQueryClient();

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters({
    status: '',
  });

  const listParams = useMemo(
    () => ({
      status: (appliedFilters.status.trim() || undefined) as CodRecordStatus | undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<CodRecord>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => CodApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: ['oms-cod-records'],
    chunkQueryKeyPrefix: 'oms-cod-records-chunk',
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CodRecordStatus }) =>
      CodApi.setStatus(id, status),
    onSuccess: () => {
      toast.success('COD status updated.');
      void qc.invalidateQueries({ queryKey: ['oms-cod-records'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<CodRecord>[] = [
    {
      header: 'Order',
      accessor: (row) =>
        row.omsOrder ? (
          <Link
            to={`/orders/oms/${row.omsOrderId}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {row.omsOrder.orderNumber}
          </Link>
        ) : (
          row.omsOrderId.slice(0, 8)
        ),
    },
    {
      header: 'Client',
      accessor: (row) => row.company?.name ?? '—',
    },
    {
      header: 'Status',
      accessor: (row) => row.status.replace(/_/g, ' '),
    },
    {
      header: 'Original',
      accessor: (row) => fmtMoney(row.originalAmount, row.currency),
    },
    {
      header: 'Current',
      accessor: (row) => fmtMoney(row.currentAmount, row.currency),
    },
    {
      header: 'Created',
      accessor: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.status === 'pending' ? (
            <Button
              size="sm"
              variant="secondary"
              loading={statusMut.isPending}
              onClick={(e) => {
                e.stopPropagation();
                statusMut.mutate({ id: row.id, status: 'available' });
              }}
            >
              Mark available
            </Button>
          ) : null}
          {row.status === 'available' ? (
            <Button
              size="sm"
              variant="secondary"
              loading={statusMut.isPending}
              onClick={(e) => {
                e.stopPropagation();
                statusMut.mutate({ id: row.id, status: 'paid_out' });
              }}
            >
              Mark paid out
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-money-bill"
      title={isArabic ? 'الدفع عند الاستلام' : 'COD'}
      subtitle={
        isArabic
          ? 'سجلات COD مع حالة التحصيل والصرف'
          : 'COD records with collection and payout status'
      }
      isArabic={isArabic}
      showSectionNav
    >
      <FilterPanel title="COD filters" onApply={applyFilters} onReset={resetFilters}>
        <SelectField
          label="Status"
          name="codStatusFilter"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={COD_STATUS_OPTIONS}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No COD records match the filters."
      />
    </AdminListPageShell>
  );
}

/** Standalone OMS returns page — not under Reporting Center. */
export function OmsReturnsPage() {
  const isArabic = useIsArabic();
  const toast = useToast();
  const qc = useQueryClient();

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters({
    status: '',
  });

  const listParams = useMemo(
    () => ({
      status: (appliedFilters.status.trim() || undefined) as OmsReturn['status'] | undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<OmsReturn>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsReturnsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: ['oms-returns'],
    chunkQueryKeyPrefix: 'oms-returns-chunk',
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => OmsReturnsApi.approve(id),
    onSuccess: () => {
      toast.success('Return approved.');
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<OmsReturn>[] = [
    {
      header: 'Return #',
      accessor: (row) => <span className="font-medium text-text-strong">{row.returnNumber}</span>,
    },
    {
      header: 'Order',
      accessor: (row) =>
        row.omsOrder ? (
          <Link
            to={`/orders/oms/${row.omsOrderId}`}
            className="font-medium text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.omsOrder.orderNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      header: 'Client',
      accessor: (row) => row.company?.name ?? '—',
    },
    {
      header: 'Status',
      accessor: (row) => row.status.replace(/_/g, ' '),
    },
    {
      header: 'Reason',
      accessor: (row) => row.reason ?? '—',
    },
    {
      header: 'Created',
      accessor: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      header: 'Actions',
      accessor: (row) =>
        row.status === 'requested' ? (
          <Button
            size="sm"
            loading={approveMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              approveMut.mutate(row.id);
            }}
          >
            Approve
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-rotate-left"
      title={isArabic ? 'مرتجعات OMS' : 'OMS Returns'}
      subtitle={
        isArabic ? 'طلبات الإرجاع التجارية لطلبات OMS' : 'Commercial return requests for OMS orders'
      }
      isArabic={isArabic}
      showSectionNav
    >
      <FilterPanel title="Return filters" onApply={applyFilters} onReset={resetFilters}>
        <SelectField
          label="Status"
          name="omsReturnStatusFilter"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={RETURN_STATUS_OPTIONS}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No OMS returns match the filters."
      />
    </AdminListPageShell>
  );
}
