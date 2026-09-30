import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge, AdvancedFilterSection, countNonEmptyFilters } from '@ds';
import type { Tone } from '@ds';
import type { CodRecord, CodRecordStatus, OmsReturn } from '../api/oms';
import { CodApi, OmsReturnsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { ConfirmReturnByScanModal } from '../components/ConfirmReturnByScanModal';
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

/** Returns that can still be confirmed (not yet terminal). */
function isConfirmableReturn(r: OmsReturn): boolean {
  return r.status === 'requested' || r.status === 'approved';
}

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
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expressOpen, setExpressOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // ─── Row selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

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

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const confirmMut = useMutation({
    mutationFn: (id: string) => OmsReturnsApi.confirmReturn(id),
    onSuccess: () => {
      toast.success(isArabic ? 'تم تأكيد الإرجاع بنجاح.' : 'Return confirmed successfully.');
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkConfirmMut = useMutation({
    mutationFn: (ids: string[]) => OmsReturnsApi.confirmReturnsBulk(ids),
    onSuccess: (result) => {
      const msg = isArabic
        ? `تم تأكيد ${result.confirmed} إرجاع${result.skipped > 0 ? `، تجاوز ${result.skipped} (مكتمل)` : ''}${result.failed > 0 ? `، فشل ${result.failed}` : ''}.`
        : `Confirmed ${result.confirmed}${result.skipped > 0 ? `, skipped ${result.skipped} (already done)` : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}.`;
      if (result.failed > 0) {
        toast.error(msg);
      } else {
        toast.success(msg);
      }
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Selection helpers ──────────────────────────────────────────────────────
  const pageIds = pagination.rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  const selectedOrders = useMemo(
    () => pagination.rows.filter((r) => selectedIds.has(r.id)),
    [pagination.rows, selectedIds],
  );

  const confirmableSelected = useMemo(
    () => selectedOrders.filter(isConfirmableReturn),
    [selectedOrders],
  );

  const columns: Column<OmsReturn>[] = [
    {
      header: (
        <input
          type="checkbox"
          aria-label={isArabic ? 'تحديد الكل' : 'Select all on page'}
          checked={allPageSelected}
          ref={(el) => {
            if (el) el.indeterminate = somePageSelected;
          }}
          onChange={toggleAll}
          className="h-4 w-4 cursor-pointer rounded border-border accent-brand-600"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      accessor: (row) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Select ${row.returnNumber}`}
            checked={selectedIds.has(row.id)}
            onChange={() => toggleRow(row.id)}
            className="h-4 w-4 cursor-pointer rounded border-border accent-brand-600"
          />
        </div>
      ),
      width: '2.5rem',
    },
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
    {
      header: 'Actions',
      accessor: (row) => (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2"
        >
          {isConfirmableReturn(row) ? (
            <button
              type="button"
              disabled={confirmMut.isPending}
              onClick={() => confirmMut.mutate(row.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Confirm return ${row.returnNumber}`}
            >
              <i className="fa-solid fa-check text-[10px]" aria-hidden />
              {isArabic ? 'تأكيد' : 'Confirm'}
            </button>
          ) : (
            <span className="text-xs text-text-faint">
              {row.status === 'completed'
                ? isArabic
                  ? 'مكتمل'
                  : 'Done'
                : '—'}
            </span>
          )}
        </div>
      ),
    },
  ];

  const selectionCount = selectedIds.size;

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setScanOpen(true)}
            className="border-emerald-600/40 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <i className="fa-solid fa-qrcode mr-1.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            {isArabic ? 'تأكيد عبر المسح (QR)' : 'Confirm by Scan (QR)'}
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            {isArabic ? 'إنشاء مرتجع' : 'Create Return'}
          </Button>
          <Button variant="primary" onClick={() => setExpressOpen(true)}>
            {isArabic ? 'مرتجع سريع' : 'Express Return'}
          </Button>
        </div>
      }
    >
      <ConfirmReturnByScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        isArabic={isArabic}
        onRefreshNeeded={() => {
          void qc.invalidateQueries({ queryKey: ['oms-returns'] });
          pagination.refetch?.();
        }}
      />
      <CreateOmsReturnModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isArabic={isArabic}
        onSuccess={() => {
          pagination.refetch?.();
        }}
      />
      <ExpressReturnModal
        open={expressOpen}
        onClose={() => setExpressOpen(false)}
        isArabic={isArabic}
        onSuccess={() => {
          pagination.refetch?.();
        }}
      />

      {/* ─── Bulk action bar ─────────────────────────────────────────────────── */}
      {selectionCount > 0 && (
        <div className="sticky top-14 z-20 mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm dark:border-emerald-800/40 dark:bg-emerald-950/30">
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {isArabic
              ? `${selectionCount} مرتجع${selectionCount === 1 ? '' : 'ات'} محددة`
              : `${selectionCount} return${selectionCount === 1 ? '' : 's'} selected`}
            {confirmableSelected.length < selectionCount && (
              <span className="ml-1.5 text-xs font-normal text-emerald-700 dark:text-emerald-300">
                ({isArabic
                  ? `${confirmableSelected.length} قابل للتأكيد`
                  : `${confirmableSelected.length} confirmable`})
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            >
              {isArabic ? 'إلغاء التحديد' : 'Clear selection'}
            </button>
            <button
              type="button"
              disabled={confirmableSelected.length === 0 || bulkConfirmMut.isPending}
              onClick={() => bulkConfirmMut.mutate(confirmableSelected.map((r) => r.id))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkConfirmMut.isPending ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-[10px]" aria-hidden />
                  {isArabic ? 'جاري التأكيد…' : 'Confirming…'}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-double text-[10px]" aria-hidden />
                  {isArabic
                    ? `تأكيد ${confirmableSelected.length} مرتجع`
                    : `Confirm ${confirmableSelected.length} return${confirmableSelected.length === 1 ? '' : 's'}`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
