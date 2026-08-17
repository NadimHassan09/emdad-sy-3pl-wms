import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AdvancedFilterSection, Alert, Button, Combobox, EmptyState, countNonEmptyFilters } from '@ds';

import { CompaniesApi } from '../api/companies';
import { InboundApi, InboundOrder } from '../api/inbound';
import { useAuth } from '../auth/AuthContext';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { CompanyNameCell } from '../components/CompanyNameCell';
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
import { InboundOrdersImportModal } from '../components/inbound/InboundOrdersImportModal';
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { buildInboundListParams } from '../lib/inbound-list-params';
import { inboundHasQuantityShortfall } from '../lib/inbound-shortfall';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { canAccessInternalTransfer } from '../lib/rbac';
import { useCachedState } from '../hooks/useCachedState';

type ListDraft = {
  orderSearch: string;
  status: string;
  createdFrom: string;
  createdTo: string;
  companyId: string;
};

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound orders': 'طلبات الوارد',
    '+ New inbound': '+ وارد جديد',
    Import: 'استيراد',
    'Export CSV': 'تصدير CSV',
    'Search order # or client…': 'ابحث برقم الطلب أو العميل…',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'No inbound orders match the filters.': 'لا توجد طلبات وارد مطابقة للفلاتر.',
    'No inbound orders yet': 'لا توجد طلبات وارد بعد',
    'Create your first inbound order to start receiving stock.':
      'أنشئ أول طلب وارد لبدء استلام المخزون.',
    'Warehouse not resolved yet.': 'لم يتم تحديد المستودع بعد.',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'All statuses': 'كل الحالات',
    Draft: 'مسودة',
    'Pending approval': 'بانتظار الموافقة',
    Confirmed: 'مؤكد',
    'In progress': 'قيد التنفيذ',
    'Partially received': 'مستلم جزئيا',
    Completed: 'مكتمل',
    Cancelled: 'ملغي',
    Actions: 'الإجراءات',
    Edit: 'تعديل',
    Delete: 'حذف',
    'Cancel order': 'إلغاء الطلب',
    'Open actions': 'فتح الإجراءات',
    'Cancel this order?': 'إلغاء هذا الطلب؟',
    'Cancelling stops all remaining work and deletes the order’s tasks. Already-received stock is not changed. This cannot be undone.':
      'سيؤدي الإلغاء إلى إيقاف جميع الأعمال المتبقية وحذف مهام الطلب. لن يتم تغيير المخزون المستلم بالفعل. لا يمكن التراجع عن هذا الإجراء.',
    'Delete this order?': 'حذف هذا الطلب؟',
    'This permanently removes the order and its lines. This action cannot be undone.':
      'سيؤدي هذا إلى حذف الطلب وبنوده نهائياً. لا يمكن التراجع عن هذا الإجراء.',
    'Keep order': 'الاحتفاظ بالطلب',
    'Order cancelled.': 'تم إلغاء الطلب.',
    'Order deleted.': 'تم حذف الطلب.',
  };
  return ar[label] ?? label;
}

export function InboundListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const [toCancel, setToCancel] = useState<InboundOrder | null>(null);
  const [toDelete, setToDelete] = useState<InboundOrder | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundLabel(label, isArabic);
  const openCreate = () => {
    navigate('/orders/inbound/new');
  };
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<ListDraft>(
    () => ({
      orderSearch: '',
      status: '',
      createdFrom: '',
      createdTo: '',
      companyId: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyPatch, applyFilters, resetFilters } =
    useFilters(initialList);
  const [advancedOpen, setAdvancedOpen] = useCachedState('inbound-orders:advanced-filters-open', false);
  const [searchParams] = useSearchParams();

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companiesQuery.data, t('All clients')),
    [companiesQuery.data, isArabic],
  );

  useEffect(() => {
    const status = searchParams.get('status') ?? '';
    if (status && status !== appliedFilters.status) {
      applyPatch({ status });
    }
  }, [searchParams, appliedFilters.status, applyPatch]);

  const listParams = useMemo(
    () => buildInboundListParams(appliedFilters, wid),
    [appliedFilters, wid],
  );

  const pagination = useChunkedServerPagination<InboundOrder>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => InboundApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.inboundOrders,
    chunkQueryKeyPrefix: 'inbound-orders-chunk',
    enabled: !!wid,
  });

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: t('All statuses') },
      { value: 'draft', label: t('Draft') },
      { value: 'pending_approval', label: t('Pending approval') },
      { value: 'confirmed', label: t('Confirmed') },
      { value: 'in_progress', label: t('In progress') },
      { value: 'partially_received', label: t('Partially received') },
      { value: 'completed', label: t('Completed') },
      { value: 'cancelled', label: t('Cancelled') },
    ],
    [isArabic],
  );

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => InboundApi.cancel(orderId),
    onSuccess: (_data, orderId) => {
      toast.success(t('Order cancelled.'));
      setToCancel(null);
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: orderId, referenceType: 'inbound_order' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (orderId: string) => InboundApi.remove(orderId),
    onSuccess: () => {
      toast.success(t('Order deleted.'));
      setToDelete(null);
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rowActions = (o: InboundOrder): RowAction[] => {
    const actions: RowAction[] = [];
    const hasReceived = (o.lines ?? []).some((l) => Number(l.receivedQuantity) > 0);
    const canEditPlan =
      o.status === 'draft' ||
      o.status === 'pending_approval' ||
      ((o.status === 'confirmed' || o.status === 'in_progress') && !hasReceived);
    if (canEditPlan) {
      actions.push({
        key: 'edit',
        label: t('Edit'),
        onClick: () => navigate(`/orders/inbound/${o.id}/edit`),
      });
    }
    if (o.status !== 'completed' && o.status !== 'cancelled') {
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

  const columns: Column<InboundOrder>[] = useMemo(
    () => [
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
        accessor: (o) => (
          <div className="flex w-fit flex-col gap-0.5">
            <StatusBadge status={o.status} />
            {inboundHasQuantityShortfall(o) &&
            (o.status === 'completed' || o.status === 'partially_received') ? (
              <span className="text-[10px] leading-tight text-status-warning-fg">
                Missing quantities
              </span>
            ) : null}
          </div>
        ),
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t('Expected arrival'),
        accessor: (o) => new Date(o.expectedArrivalDate).toLocaleDateString(),
        width: '160px',
      },
      { header: t('Lines'), accessor: (o) => o._count?.lines ?? 0, width: '70px' },
      {
        header: t('Created'),
        accessor: (o) => new Date(o.createdAt).toLocaleString(),
      },
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
    [isArabic, isAdmin],
  );

  const hasActiveFilters = Boolean(
    appliedFilters.orderSearch.trim() ||
      appliedFilters.status.trim() ||
      appliedFilters.createdFrom.trim() ||
      appliedFilters.createdTo.trim(),
  );

  const emptyContent = !wid ? (
    t('Warehouse not resolved yet.')
  ) : hasActiveFilters ? (
    t('No inbound orders match the filters.')
  ) : (
    <EmptyState
      title={t('No inbound orders yet')}
      description={t('Create your first inbound order to start receiving stock.')}
      action={
        <Button
          variant="primary"
          size="md"
          onClick={openCreate}
          className={FILTER_PRIMARY_BUTTON_CLASS}
        >
          {t('+ New inbound')}
        </Button>
      }
    />
  );

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await InboundApi.exportDownload(listParams);
      toast.success(
        isArabic ? 'تم تنزيل ملف CSV للطلبات المفلترة.' : 'Exported filtered inbound orders to CSV.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const newButton = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="md"
        onClick={() => setImportOpen(true)}
      >
        {t('Import')}
      </Button>
      <Button
        variant="secondary"
        size="md"
        loading={exporting}
        disabled={exporting}
        onClick={() => void onExport()}
      >
        {t('Export CSV')}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={openCreate}
        className={FILTER_PRIMARY_BUTTON_CLASS}
      >
        {t('+ New inbound')}
      </Button>
    </div>
  );

  return (
    <AdminListPageShell icon="fa-arrow-down" title={t('Inbound orders')} isArabic={isArabic} navActions={newButton}>
      {!wid && (
        <Alert
          variant="warning"
          title="Warehouse not configured"
          description="The active warehouse could not be resolved. Contact your administrator."
          compact
        />
      )}

      {pagination.isError && (
        <Alert
          variant="error"
          title="Could not load inbound orders"
          description="Check your connection and try refreshing the page."
          action={
            <Alert.Action variant="error" onClick={() => pagination.refetch()}>
              Retry
            </Alert.Action>
          }
        />
      )}

      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, [
          'status',
          'createdFrom',
          'createdTo',
          'companyId',
        ])}
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
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
            <select
              value={draftFilters.status}
              onChange={(e) => setDraft({ status: e.target.value })}
              aria-label={t('Status')}
              className={FILTER_COMPACT_SELECT_CLASS}
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
            {t('Order #')}
          </label>
          <input
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ orderSearch: e.target.value })}
            placeholder={t('Search order # or client…')}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <Combobox
            label={t('Client')}
            value={draftFilters.companyId}
            onChange={(value) => setDraft({ companyId: value })}
            options={clientOptions}
            placeholder={t('All clients')}
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
      </AdvancedFilterSection>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(o) => o.id}
        loading={pagination.isInitialLoading || !wid}
        onRowClick={(o) => navigate(`/orders/inbound/${o.id}`)}
        empty={emptyContent}
        serverPagination={pagination.serverPagination}
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
            'Cancelling stops all remaining work and deletes the order’s tasks. Already-received stock is not changed. This cannot be undone.',
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

      <InboundOrdersImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void qc.invalidateQueries({ queryKey: QK.inboundOrders });
        }}
      />
    </AdminListPageShell>
  );
}
