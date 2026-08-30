import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AdvancedFilterSection, Button, Card } from '@ds';
import { CompaniesApi } from '../api/companies';
import type { OmsOrderListItem } from '../api/oms';
import { OmsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Combobox } from '../components/Combobox';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { OmsOrdersImportModal } from '../components/oms/OmsOrdersImportModal';
import { OmsOrdersExportModal } from '../components/oms/OmsOrdersExportModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import {
  FILTER_COMPACT_SEARCH_CLASS,
  FILTER_COMPACT_SELECT_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from '../components/filter-panel-styles';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { OMS_COMMERCIAL_FILTER_OPTIONS } from '../lib/oms-commercial-status';
import { isOmsOrderDeletable } from '../lib/oms-order-delete';
import {
  buildOmsAppliedFilterSummary,
  buildOmsOrdersListParams,
  countAppliedOmsAdvancedFilters,
  normalizeOmsOrdersListFilters,
  OMS_ORDERS_FILTER_DEFAULTS,
  OMS_TOTAL_OPERATOR_OPTIONS,
  type OmsOrdersListFilters,
  type OmsTotalOperator,
} from '../lib/oms-orders-list-filters';
import { useCachedState } from '../hooks/useCachedState';

const OMS_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...OMS_COMMERCIAL_FILTER_OPTIONS.filter((o) => o.value !== ''),
];

function FilterFieldLabel({ children }: { children: string }) {
  return (
    <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
      {children}
    </label>
  );
}

export function OmsOrdersListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');

  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exportColumns, setExportColumns] = useState<Array<{ id: string; labelEn: string; labelAr: string }>>([]);
  const [advancedOpen, setAdvancedOpen] = useCachedState(
    'oms-orders:advanced-filters-open',
    false,
  );

  const editDetailQuery = useQuery({
    queryKey: [...QK.omsOrders, editOrderId],
    queryFn: () => OmsApi.getOrder(editOrderId!),
    enabled: !!editOrderId,
  });

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientOptions = useMemo(
    () =>
      companyFilterComboboxOptions(
        companiesQuery.data,
        isArabic ? 'كل العملاء' : 'All clients',
      ),
    [companiesQuery.data, isArabic],
  );

  const {
    draftFilters: draftFiltersRaw,
    appliedFilters: appliedFiltersRaw,
    setDraft,
    applyPatch,
    applyFilters,
    resetFilters,
  } = useFilters<OmsOrdersListFilters>(OMS_ORDERS_FILTER_DEFAULTS);

  // Older cached filter entries only had orderSearch/status — fill missing keys.
  const draftFilters = useMemo(
    () => normalizeOmsOrdersListFilters(draftFiltersRaw),
    [draftFiltersRaw],
  );
  const appliedFilters = useMemo(
    () => normalizeOmsOrdersListFilters(appliedFiltersRaw),
    [appliedFiltersRaw],
  );

  const listParams = useMemo(
    () => buildOmsOrdersListParams(appliedFilters),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<OmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsOrders,
    chunkQueryKeyPrefix: 'oms-orders-chunk',
  });

  const advancedActiveCount = countAppliedOmsAdvancedFilters(appliedFilters);
  const statusLabel =
    OMS_STATUS_FILTER_OPTIONS.find((o) => o.value === appliedFilters.status)?.label ?? null;
  const clientName =
    companiesQuery.data?.find((c) => c.id === appliedFilters.companyId)?.name ?? null;
  const appliedSummary = useMemo(
    () =>
      buildOmsAppliedFilterSummary(appliedFilters, {
        clientName,
        statusLabel,
        isArabic,
      }),
    [appliedFilters, clientName, statusLabel, isArabic],
  );

  const onApplyFilters = () => {
    if (advancedOpen) {
      applyPatch({
        ...draftFilters,
        orderSearch: '',
      });
      return;
    }
    applyFilters();
  };

  const onResetFilters = () => {
    resetFilters();
    setAdvancedOpen(false);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => OmsApi.delete(id),
    onSuccess: () => {
      toast.success('E-commerce order deleted.');
      setDeleteOrder(null);
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  useEffect(() => {
    void OmsApi.exportColumns()
      .then(setExportColumns)
      .catch(() => setExportColumns([]));
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listParams]);

  const pageIds = useMemo(() => pagination.rows.map((r) => r.id), [pagination.rows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return;
    setExporting(true);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      await OmsApi.exportDownloadPost({
        ...listParams,
        ...payload,
        ids,
      });
      setExportOpen(false);
      toast.success(
        isArabic ? 'تم تنزيل ملف CSV.' : 'Exported OMS orders to CSV.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const navActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" size="md" onClick={() => setImportOpen(true)}>
        {isArabic ? 'استيراد' : 'Import'}
      </Button>
      <Button
        variant="secondary"
        size="md"
        loading={exporting}
        disabled={exporting}
        onClick={() => setExportOpen(true)}
      >
        {isArabic ? 'تصدير CSV' : 'Export CSV'}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={() => navigate('/orders/oms/new')}
        className={FILTER_PRIMARY_BUTTON_CLASS}
      >
        {isArabic ? 'إنشاء طلب OMS' : 'Create OMS Order'}
      </Button>
    </div>
  );

  const columns: Column<OmsOrderListItem>[] = [
    {
      header: (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
          checked={allPageSelected}
          ref={(el) => {
            if (el) el.indeterminate = somePageSelected;
          }}
          aria-label={isArabic ? 'تحديد الكل في الصفحة' : 'Select all on page'}
          onChange={(e) => toggleAllPage(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      width: '2.5rem',
      accessor: (row) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
          checked={selectedIds.has(row.id)}
          aria-label={`Select ${row.orderNumber}`}
          onChange={(e) => toggleOne(row.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
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
      accessor: (row) => (
        <OmsStatusBadge status={row.status} isArabic={isArabic} needsInformation={row.needsInformation} />
      ),
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
              ...(isOmsOrderDeletable(row.status)
                ? [
                    {
                      key: 'delete',
                      label: 'Delete',
                      danger: true,
                      onClick: () => setDeleteOrder(row),
                    } as const,
                  ]
                : []),
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
      navActions={navActions}
    >
      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        activeCount={advancedActiveCount}
        summary={appliedSummary}
        isArabic={isArabic}
        loading={pagination.isFetching}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        compact={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <i
                className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
                aria-hidden
              />
              <input
                value={draftFilters.orderSearch}
                onChange={(e) => setDraft({ orderSearch: e.target.value })}
                placeholder={
                  isArabic
                    ? 'بحث: رقم الطلب، العملاء، الزبائن، الهاتف…'
                    : 'Search orders, clients, customers, phone...'
                }
                aria-label={isArabic ? 'بحث سريع' : 'Quick search'}
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
            <select
              value={draftFilters.status}
              onChange={(e) => setDraft({ status: e.target.value })}
              aria-label={isArabic ? 'الحالة' : 'Status'}
              className={FILTER_COMPACT_SELECT_CLASS}
            >
              {OMS_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'رقم الطلب' : 'Order ID'}</FilterFieldLabel>
          <input
            value={draftFilters.orderId}
            onChange={(e) => setDraft({ orderId: e.target.value })}
            placeholder={isArabic ? 'رقم الطلب أو المرجع…' : 'Order # or reference…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <Combobox
            label={isArabic ? 'العميل' : 'Client'}
            value={draftFilters.companyId}
            onChange={(value) => setDraft({ companyId: value })}
            options={clientOptions}
            placeholder={isArabic ? 'ابحث عن عميل…' : 'Search client…'}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الزبون' : 'Customer'}</FilterFieldLabel>
          <input
            value={draftFilters.customer}
            onChange={(e) => setDraft({ customer: e.target.value })}
            placeholder={isArabic ? 'اسم الزبون…' : 'Customer name…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الهاتف' : 'Phone'}</FilterFieldLabel>
          <input
            value={draftFilters.phone}
            onChange={(e) => setDraft({ phone: e.target.value })}
            placeholder={isArabic ? 'رقم الهاتف…' : 'Phone…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'المدينة' : 'City'}</FilterFieldLabel>
          <input
            value={draftFilters.city}
            onChange={(e) => setDraft({ city: e.target.value })}
            placeholder={isArabic ? 'المدينة…' : 'City…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الإجمالي / التكلفة' : 'Total / Cost'}</FilterFieldLabel>
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-2">
            <select
              value={draftFilters.totalOp || 'gte'}
              onChange={(e) => setDraft({ totalOp: e.target.value as OmsTotalOperator })}
              aria-label={isArabic ? 'عامل الإجمالي' : 'Total operator'}
              className={FILTER_FIELD_CONTROL_CLASS}
            >
              {OMS_TOTAL_OPERATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={draftFilters.totalValue}
              onChange={(e) => setDraft({ totalValue: e.target.value })}
              placeholder="0"
              aria-label={isArabic ? 'قيمة الإجمالي' : 'Total value'}
              className={FILTER_FIELD_CONTROL_CLASS}
            />
          </div>
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الحالة' : 'Status'}</FilterFieldLabel>
          <select
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            {OMS_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>

      {pagination.isError ? (
        <Card padding="md" className="mb-4 border-status-error-border bg-status-error-bg">
          <p className="text-sm text-status-error-fg">
            {(pagination.error as Error)?.message ||
              (isArabic ? 'تعذر تحميل الطلبات.' : 'Failed to load orders.')}
          </p>
        </Card>
      ) : null}

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

      <OmsOrdersImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
      />

      <OmsOrdersExportModal
        open={exportOpen}
        onClose={() => {
          if (!exporting) setExportOpen(false);
        }}
        columns={exportColumns}
        exporting={exporting}
        onExport={(payload) => void onExportSubmit(payload)}
        isArabic={isArabic}
      />


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
