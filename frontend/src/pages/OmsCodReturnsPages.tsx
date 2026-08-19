import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge, AdvancedFilterSection, countNonEmptyFilters } from '@ds';
import type { Tone } from '@ds';
import type { CodRecord, CodRecordStatus, OmsReturn } from '../api/oms';
import { CodApi, OmsReturnsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { CreateOmsReturnModal } from '../components/oms/CreateOmsReturnModal';
import { ExpressReturnModal } from '../components/oms/ExpressReturnModal';
import { Column, DataTable } from '../components/DataTable';
import { useToast } from '../components/ToastProvider';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { useCachedState } from '../hooks/useCachedState';
import {
  FILTER_COMPACT_SEARCH_CLASS,
  FILTER_COMPACT_SELECT_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from '../components/filter-panel-styles';

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

const COD_RECORD_STATUS_OPTIONS: { value: CodRecordStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'available', label: 'Available' },
  { value: 'paid_out', label: 'Paid out' },
  { value: 'returned', label: 'Returned' },
];

const COD_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...COD_RECORD_STATUS_OPTIONS,
];

const COD_STATUS_TONE: Record<CodRecordStatus, Tone> = {
  pending: 'warning',
  available: 'brand',
  paid_out: 'success',
  returned: 'danger',
};

const COD_STATUS_SELECT_CLASS: Record<CodRecordStatus, string> = {
  pending:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100',
  available:
    'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700/50 dark:bg-brand-950/40 dark:text-brand-100',
  paid_out:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  returned:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100',
};

const RETURN_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const RETURN_STATUS_TONE: Record<OmsReturn['status'], Tone> = {
  requested: 'warning',
  approved: 'brand',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

/** Standalone OMS COD page — not under Reporting Center. */
export function OmsCodPage() {
  const isArabic = useIsArabic();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters({
      search: '',
      status: '',
    });
  const [advancedOpen, setAdvancedOpen] = useCachedState('oms-cod:advanced-filters-open', false);

  const listParams = useMemo(
    () => ({
      search: (appliedFilters.search ?? '').trim() || undefined,
      status: ((appliedFilters.status ?? '').trim() || undefined) as CodRecordStatus | undefined,
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
            onClick={(e) => e.stopPropagation()}
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
      header: 'Recipient',
      accessor: (row) => row.omsOrder?.recipientName?.trim() || '—',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <Badge tone={COD_STATUS_TONE[row.status]} size="xs" dot className="w-fit max-w-max">
          {COD_RECORD_STATUS_OPTIONS.find((o) => o.value === row.status)?.label ?? row.status}
        </Badge>
      ),
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
        <div
          className="w-[7.75rem]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <select
            aria-label="Change COD status"
            name={`cod-status-${row.id}`}
            value={row.status}
            disabled={statusMut.isPending}
            className={`input-premium w-full rounded-md border px-2 py-1 text-xs font-semibold ${COD_STATUS_SELECT_CLASS[row.status]}`}
            onChange={(e) => {
              const next = e.target.value as CodRecordStatus;
              if (next === row.status) return;
              statusMut.mutate({ id: row.id, status: next });
            }}
          >
            {COD_RECORD_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, ['status'])}
        onApply={applyFilters}
        onReset={() => {
          resetFilters();
          setAdvancedOpen(false);
        }}
        compact={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <i
                className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
                aria-hidden
              />
              <input
                value={draftFilters.search ?? ''}
                onChange={(e) => setDraft({ search: e.target.value })}
                placeholder={
                  isArabic
                    ? 'بحث: الطلب، العميل، المستلم…'
                    : 'Search order, client, recipient…'
                }
                aria-label={isArabic ? 'بحث' : 'Search'}
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
            <select
              value={draftFilters.status}
              onChange={(e) => setDraft({ status: e.target.value })}
              aria-label={isArabic ? 'الحالة' : 'Status'}
              className={FILTER_COMPACT_SELECT_CLASS}
            >
              {COD_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {isArabic ? 'بحث' : 'Search'}
          </label>
          <input
            value={draftFilters.search ?? ''}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={
              isArabic
                ? 'بحث: الطلب، العميل، المستلم…'
                : 'Search order, client, recipient…'
            }
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {isArabic ? 'الحالة' : 'Status'}
          </label>
          <select
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            {COD_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No COD records match the filters."
        onRowClick={(row) => navigate(`/oms/cod/${row.id}`)}
      />
    </AdminListPageShell>
  );
}

/** Standalone OMS returns page — not under Reporting Center. */
export function OmsReturnsPage() {
  const isArabic = useIsArabic();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [expressOpen, setExpressOpen] = useState(false);

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters({
      search: '',
      status: '',
    });
  const [advancedOpen, setAdvancedOpen] = useCachedState(
    'oms-returns:advanced-filters-open',
    false,
  );

  const listParams = useMemo(
    () => ({
      search: (appliedFilters.search ?? '').trim() || undefined,
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

  const columns: Column<OmsReturn>[] = [
    {
      header: 'Return #',
      accessor: (row) => (
        <Link
          to={`/oms/returns/${row.id}`}
          className="font-medium text-brand-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.returnNumber}
        </Link>
      ),
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
      accessor: (row) => (
        <Badge tone={RETURN_STATUS_TONE[row.status]} size="xs" dot className="w-fit max-w-max">
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Reason',
      accessor: (row) => row.reason ?? '—',
    },
    {
      header: 'Created',
      accessor: (row) => new Date(row.createdAt).toLocaleString(),
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
      actions={
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            {isArabic ? 'إنشاء مرتجع' : 'Create Return'}
          </Button>
          <Button variant="primary" onClick={() => setExpressOpen(true)}>
            {isArabic ? 'مرتجع سريع' : 'Express Return'}
          </Button>
        </div>
      }
    >
      <CreateOmsReturnModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isArabic={isArabic}
        onSuccess={(created) => navigate(`/oms/returns/${created.id}`)}
      />
      <ExpressReturnModal
        open={expressOpen}
        onClose={() => setExpressOpen(false)}
        isArabic={isArabic}
        onSuccess={() => { pagination.refetch?.(); }}
      />
      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, ['status'])}
        onApply={applyFilters}
        onReset={() => {
          resetFilters();
          setAdvancedOpen(false);
        }}
        compact={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <i
                className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
                aria-hidden
              />
              <input
                value={draftFilters.search ?? ''}
                onChange={(e) => setDraft({ search: e.target.value })}
                placeholder={
                  isArabic
                    ? 'بحث: المرتجع، الطلب، العميل…'
                    : 'Search return #, order, client…'
                }
                aria-label={isArabic ? 'بحث' : 'Search'}
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
            <select
              value={draftFilters.status}
              onChange={(e) => setDraft({ status: e.target.value })}
              aria-label={isArabic ? 'الحالة' : 'Status'}
              className={FILTER_COMPACT_SELECT_CLASS}
            >
              {RETURN_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {isArabic ? 'بحث' : 'Search'}
          </label>
          <input
            value={draftFilters.search ?? ''}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={
              isArabic
                ? 'بحث: المرتجع، الطلب، العميل…'
                : 'Search return #, order, client…'
            }
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {isArabic ? 'الحالة' : 'Status'}
          </label>
          <select
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            {RETURN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No OMS returns match the filters."
        onRowClick={(row) => navigate(`/oms/returns/${row.id}`)}
      />
    </AdminListPageShell>
  );
}
