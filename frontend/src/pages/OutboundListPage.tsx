import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { OutboundApi, OutboundOrder } from '../api/outbound';
import { useAuth } from '../auth/AuthContext';
import { Alert, AdvancedFilterSection, Button as DsButton, countNonEmptyFilters } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { CompanyNameCell } from '../components/CompanyNameCell';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from '../components/filter-panel-styles';
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu';
import { OutboundOrdersImportModal } from '../components/outbound/OutboundOrdersImportModal';
import { BulkShippingProcessingModal } from '../components/shipping/BulkShippingProcessingModal';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { buildOutboundListParams } from '../lib/outbound-list-params';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { canAccessInternalTransfer } from '../lib/rbac';
import { useDebounced } from '../lib/useDebounced';
import { useCachedState } from '../hooks/useCachedState';

type OutListDraft = {
  orderSearch: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound orders': 'طلبات الصادر',
    '+ New outbound': '+ صادر جديد',
    Import: 'استيراد',
    'Export CSV': 'تصدير CSV',
    'Search order # or client…': 'ابحث برقم الطلب أو العميل…',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Required ship': 'الشحن المطلوب',
    Lines: 'البنود',
    Destination: 'الوجهة',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'All statuses': 'كل الحالات',
    Draft: 'مسودة',
    'Pending approval': 'بانتظار الموافقة',
    'Pending stock': 'بانتظار المخزون',
    Confirmed: 'مؤكد',
    Picking: 'التقاط',
    Packing: 'تغليف',
    'Waiting for Shipping Details': 'بانتظار تفاصيل الشحن',
    'Waiting for Dispatch': 'بانتظار الإرسال',
    Shipped: 'تم الشحن',
    Cancelled: 'ملغي',
    Actions: 'الإجراءات',
    Edit: 'تعديل',
    Delete: 'حذف',
    'Cancel order': 'إلغاء الطلب',
    'Open actions': 'فتح الإجراءات',
    'Cancel this order?': 'إلغاء هذا الطلب؟',
    'Cancelling stops all remaining work and deletes the order’s tasks. Product quantities are not changed. This cannot be undone.':
      'سيؤدي الإلغاء إلى إيقاف جميع الأعمال المتبقية وحذف مهام الطلب. لن يتم تغيير كميات المنتجات. لا يمكن التراجع عن هذا الإجراء.',
    'Delete this order?': 'حذف هذا الطلب؟',
    'This permanently removes the order and its lines. This action cannot be undone.':
      'سيؤدي هذا إلى حذف الطلب وبنوده نهائياً. لا يمكن التراجع عن هذا الإجراء.',
    'Keep order': 'الاحتفاظ بالطلب',
    'Order cancelled.': 'تم إلغاء الطلب.',
    'Order deleted.': 'تم حذف الطلب.',
    'Bulk Shipping Processing': 'معالجة الشحن الجماعي',
    'Select Waiting for Dispatch orders without an existing carrier shipment.':
      'اختر طلبات بانتظار الإرسال دون شحنة ناقلة قائمة.',
  };
  return ar[label] ?? label;
}


function isBulkShippingCandidate(o: OutboundOrder): boolean {
  if (o.status !== 'ready_to_ship') return false;
  if (o.trackingNumber?.trim()) return false;
  const created = (o.carrierShipments ?? []).some((s) => s.status === 'created');
  return !created;
}

export function OutboundListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const [toCancel, setToCancel] = useState<OutboundOrder | null>(null);
  const [toDelete, setToDelete] = useState<OutboundOrder | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const t = (label: string) => outboundLabel(label, isArabic);
  const openCreate = () => {
    navigate('/orders/outbound/new');
  };
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<OutListDraft>(
    () => ({
      orderSearch: '',
      status: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyPatch, applyFilters, resetFilters } =
    useFilters(initialList);
  const [advancedOpen, setAdvancedOpen] = useCachedState(
    'outbound-orders:advanced-filters-open',
    false,
  );
  const [searchParams] = useSearchParams();
  const debouncedSearch = useDebounced(draftFilters.orderSearch, 300);

  useEffect(() => {
    const status = searchParams.get('status') ?? '';
    if (status && status !== appliedFilters.status) {
      applyPatch({ status });
    }
  }, [searchParams, appliedFilters.status, applyPatch]);

  useEffect(() => {
    if (advancedOpen) return;
    if (debouncedSearch === appliedFilters.orderSearch) return;
    applyPatch({ orderSearch: debouncedSearch });
  }, [advancedOpen, debouncedSearch, appliedFilters.orderSearch, applyPatch]);

  const listParams = useMemo(
    () => buildOutboundListParams(appliedFilters, wid),
    [appliedFilters, wid],
  );

  const pagination = useChunkedServerPagination<OutboundOrder>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OutboundApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.outboundOrders,
    chunkQueryKeyPrefix: 'outbound-orders-chunk',
    enabled: !!wid,
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listParams]);

  const pageEligibleIds = useMemo(
    () => pagination.rows.filter(isBulkShippingCandidate).map((o) => o.id),
    [pagination.rows],
  );

  const selectedEligibleIds = useMemo(() => [...selectedIds], [selectedIds]);

  const allPageEligibleSelected =
    pageEligibleIds.length > 0 && pageEligibleIds.every((id) => selectedIds.has(id));

  const toggleOne = (id: string, eligible: boolean) => {
    if (!eligible) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPageEligible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageEligibleSelected) {
        for (const id of pageEligibleIds) next.delete(id);
      } else {
        for (const id of pageEligibleIds) next.add(id);
      }
      return next;
    });
  };

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: t('All statuses') },
      { value: 'draft', label: t('Draft') },
      { value: 'pending_approval', label: t('Pending approval') },
      { value: 'pending_stock', label: t('Pending stock') },
      { value: 'confirmed', label: t('Confirmed') },
      { value: 'picking', label: t('Picking') },
      { value: 'packing', label: t('Packing') },
      { value: 'waiting_for_shipping_details', label: t('Waiting for Shipping Details') },
      { value: 'ready_to_ship', label: t('Waiting for Dispatch') },
      { value: 'shipped', label: t('Shipped') },
      { value: 'externally_fulfilled', label: t('Fulfilled outside warehouse') },
      { value: 'cancelled', label: t('Cancelled') },
    ],
    [isArabic],
  );

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => OutboundApi.cancel(orderId),
    onSuccess: (_data, orderId) => {
      toast.success(t('Order cancelled.'));
      setToCancel(null);
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      invalidateWorkflowTasksInventory(qc, {
        referenceId: orderId,
        referenceType: 'outbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (orderId: string) => OutboundApi.remove(orderId),
    onSuccess: () => {
      toast.success(t('Order deleted.'));
      setToDelete(null);
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rowActions = (o: OutboundOrder): RowAction[] => {
    const actions: RowAction[] = [];
    if (o.status === 'draft' || o.status === 'pending_approval') {
      actions.push({
        key: 'edit',
        label: t('Edit'),
        onClick: () => navigate(`/orders/outbound/${o.id}`),
      });
    }
    if (o.status !== 'shipped' && o.status !== 'cancelled') {
      actions.push({
        key: 'cancel',
        label: t('Cancel order'),
        danger: true,
        onClick: () => setToCancel(o),
      });
    }
    if (isAdmin && o.status === 'cancelled') {
      actions.push({
        key: 'delete',
        label: t('Delete'),
        danger: true,
        onClick: () => setToDelete(o),
      });
    }
    return actions;
  };

  const columns: Column<OutboundOrder>[] = useMemo(
    () => [
      ...(isAdmin
        ? [
            {
              header: (
                <input
                  type="checkbox"
                  aria-label="Select all eligible on page"
                  checked={allPageEligibleSelected}
                  disabled={pageEligibleIds.length === 0}
                  onChange={toggleAllPageEligible}
                  onClick={(e) => e.stopPropagation()}
                />
              ),
              accessor: (o: OutboundOrder) => {
                const eligible = isBulkShippingCandidate(o);
                return (
                  <input
                    type="checkbox"
                    aria-label={`Select ${o.orderNumber}`}
                    checked={selectedIds.has(o.id)}
                    disabled={!eligible}
                    title={
                      eligible
                        ? undefined
                        : t(
                            'Select Waiting for Dispatch orders without an existing carrier shipment.',
                          )
                    }
                    onChange={() => toggleOne(o.id, eligible)}
                    onClick={(e) => e.stopPropagation()}
                  />
                );
              },
              width: '44px',
              className: 'w-1',
            } as Column<OutboundOrder>,
          ]
        : []),
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      {
        header: t('Client'),
        accessor: (o) => (
          <CompanyNameCell name={o.company?.name} logoUrl={o.company?.logoUrl} />
        ),
        width: '220px',
      },
      {
        header: t('Status'),
        accessor: (o) => <StatusBadge status={o.status} />,
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t('Required ship'),
        accessor: (o) => new Date(o.requiredShipDate).toLocaleDateString(),
        width: '140px',
      },
      { header: t('Lines'), accessor: (o) => o._count?.lines ?? 0, width: '70px' },
      { header: t('Destination'), accessor: (o) => o.destinationAddress },
      {
        header: t('Actions'),
        accessor: (o) => (
          <RowActionsMenu items={rowActions(o)} ariaLabel={t('Open actions')} />
        ),
        className: 'w-1 whitespace-nowrap text-center',
        width: '90px',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, isAdmin, selectedIds, allPageEligibleSelected, pageEligibleIds],
  );

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await OutboundApi.exportDownload(listParams);
      toast.success(
        isArabic ? 'تم تنزيل ملف CSV للطلبات المفلترة.' : 'Exported filtered outbound orders to CSV.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const newButton = (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <DsButton
          variant="secondary"
          size="md"
          disabled={selectedEligibleIds.length === 0}
          onClick={() => setBulkOpen(true)}
          title={
            selectedEligibleIds.length === 0
              ? t('Select Waiting for Dispatch orders without an existing carrier shipment.')
              : undefined
          }
        >
          {t('Bulk Shipping Processing')}
          {selectedEligibleIds.length > 0 ? ` (${selectedEligibleIds.length})` : ''}
        </DsButton>
      )}
      <DsButton
        variant="secondary"
        size="md"
        onClick={() => setImportOpen(true)}
      >
        {t('Import')}
      </DsButton>
      <DsButton
        variant="secondary"
        size="md"
        loading={exporting}
        disabled={exporting}
        onClick={() => void onExport()}
      >
        {t('Export CSV')}
      </DsButton>
      <DsButton
        variant="primary"
        size="md"
        onClick={openCreate}
        className={FILTER_PRIMARY_BUTTON_CLASS}
      >
        {t('+ New outbound')}
      </DsButton>
    </div>
  );

  return (
    <AdminListPageShell
      icon="fa-arrow-up"
      title={t('Outbound orders')}
      isArabic={isArabic}
      navActions={newButton}
    >
      {!wid && (
        <Alert
          variant="warning"
          title="Warehouse not configured"
          description="No default warehouse is set. Contact your administrator to configure warehouse settings before creating outbound orders."
          className="mb-4"
        />
      )}

      {pagination.isError && (
        <Alert
          variant="error"
          title="Failed to load outbound orders"
          description="There was a problem retrieving your orders. Check your connection and try again."
          className="mb-4"
          onDismiss={() => pagination.refetch()}
        >
          <Alert.Action onClick={() => pagination.refetch()}>Retry</Alert.Action>
        </Alert>
      )}

      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, ['status', 'createdFrom', 'createdTo'])}
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
                value={draftFilters.orderSearch}
                onChange={(e) => setDraft({ orderSearch: e.target.value })}
                placeholder={t('Search order # or client…')}
                className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken py-2 pl-9 pr-4 text-sm text-text-strong placeholder:text-text-faint"
              />
            </div>
            <select
              value={draftFilters.status}
              onChange={(e) => applyPatch({ status: e.target.value })}
              aria-label={t('Status')}
              className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm text-text-body sm:w-auto"
            >
              {statusFilterOptions.map((opt) => (
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
            {t('Created from')}
          </label>
          <input
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {t('Created to')}
          </label>
          <input
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {t('Status')}
          </label>
          <select
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            {statusFilterOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>
      {isAdmin && selectedEligibleIds.length > 0 && (
        <p className="mb-4 text-xs text-text-muted">
          {selectedEligibleIds.length} eligible order(s) selected for {t('Bulk Shipping Processing')}.
          Tip: filter status to Waiting for Dispatch.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(o) => o.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading || !wid}
        onRowClick={(o) => navigate(`/orders/outbound/${o.id}`)}
        empty={wid ? 'No outbound orders match the filters.' : 'Warehouse not resolved yet.'}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <ConfirmModal
        open={!!toCancel}
        title={t('Cancel this order?')}
        confirmLabel={t('Cancel order')}
        cancelLabel={t('Keep order')}
        danger
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setToCancel(null)}
        onConfirm={() => toCancel && cancelMut.mutate(toCancel.id)}
      >
        <p className="text-sm">
          {t(
            'Cancelling stops all remaining work and deletes the order’s tasks. Product quantities are not changed. This cannot be undone.',
          )}
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={!!toDelete}
        title={t('Delete this order?')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      >
        <p className="text-sm">
          {t('This permanently removes the order and its lines. This action cannot be undone.')}
        </p>
      </ConfirmModal>
      {isAdmin && (
        <BulkShippingProcessingModal
          open={bulkOpen}
          outboundOrderIds={selectedEligibleIds}
          onClose={() => {
            setBulkOpen(false);
            setSelectedIds(new Set());
            qc.invalidateQueries({ queryKey: QK.outboundOrders });
          }}
        />
      )}

      <OutboundOrdersImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void qc.invalidateQueries({ queryKey: QK.outboundOrders });
        }}
      />
    </AdminListPageShell>
  );
}

