import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, Button, EmptyState } from '@ds';

import { CompaniesApi } from '../api/companies';
import {
  InboundApi,
  InboundOrder,
  InboundOrderStatus,
} from '../api/inbound';
import { useAuth } from '../auth/AuthContext';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import {
  FILTER_PRIMARY_BUTTON_CLASS,
  FILTER_RESET_BUTTON_CLASS,
  FilterPanel,
} from '../components/FilterPanel';
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { inboundHasQuantityShortfall } from '../lib/inbound-shortfall';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { canAccessInternalTransfer } from '../lib/rbac';

type ListDraft = {
  orderSearch: string;
  companyId: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound orders': 'طلبات الوارد',
    '+ New inbound': '+ وارد جديد',
    'Search order...': 'ابحث عن الطلب...',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'No inbound orders match the filters.': 'لا توجد طلبات وارد مطابقة للفلاتر.',
    'No inbound orders yet': 'لا توجد طلبات وارد بعد',
    'No inbound orders yet.': 'لا توجد طلبات وارد بعد.',
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
    'New inbound order': 'طلب وارد جديد',
    'Expected arrival date': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    Barcode: 'الباركود',
    'Scan or type…': 'امسح أو اكتب…',
    'Add by barcode': 'إضافة بالباركود',
    'Scan barcode': 'مسح الباركود',
    '+ Add line': '+ إضافة بند',
    'No lines yet — add a product below.': 'لا توجد بنود بعد — أضف منتجاً بالأسفل.',
    Remove: 'إزالة',
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Quantity: 'الكمية',
    Cancel: 'إلغاء',
    Back: 'رجوع',
    Create: 'إنشاء',
    'All clients': 'كل العملاء',
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
    'Expected arrival date cannot be before today.':
      'لا يمكن أن يكون تاريخ الوصول المتوقع قبل اليوم.',
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
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundLabel(label, isArabic);
  const openCreate = () => {
    navigate('/orders/inbound/new');
  };
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<ListDraft>(
    () => ({
      orderSearch: '',
      companyId: '',
      status: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters(initialList);

  const listParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      companyId: appliedFilters.companyId || undefined,
      status: (appliedFilters.status.trim() || undefined) as InboundOrderStatus | undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
    }),
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

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients')),
    [companies.data, isArabic],
  );

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
      actions.push({ key: 'cancel', label: t('Cancel order'), danger: true, onClick: () => setToCancel(o) });
    }
    if (isAdmin && o.status === 'cancelled') {
      actions.push({ key: 'delete', label: t('Delete'), danger: true, onClick: () => setToDelete(o) });
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
        accessor: (o) => o.company?.name ?? '—',
        width: '200px',
      },
      {
        header: t('Status'),
        accessor: (o) => (
          <div className="flex w-fit flex-col gap-0.5">
            <StatusBadge status={o.status} />
            {inboundHasQuantityShortfall(o) && (o.status === 'completed' || o.status === 'partially_received') ? (
              <span className="text-[10px] leading-tight text-status-warning-fg">Missing quantities</span>
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
        accessor: (o) => <RowActionsMenu items={rowActions(o)} ariaLabel={t('Open actions')} />,
        className: 'w-1 whitespace-nowrap text-center',
        width: '90px',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, isAdmin],
  );

  const hasActiveFilters = Boolean(
    appliedFilters.orderSearch.trim() ||
      appliedFilters.companyId ||
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

  return (
    <AdminListPageShell
      icon="fa-arrow-down"
      title={t('Inbound orders')}
      isArabic={isArabic}
      actions={
        <Button
          variant="primary"
          size="md"
          onClick={openCreate}
          className={FILTER_PRIMARY_BUTTON_CLASS}
        >
          {t('+ New inbound')}
        </Button>
      }
    >
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

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
        chips={[
          appliedFilters.orderSearch.trim()
            ? {
                key: 'orderSearch',
                label: `${t('Order #')}: ${appliedFilters.orderSearch.trim()}`,
                onClear: () => applyPatch({ orderSearch: '' }),
              }
            : null,
          appliedFilters.companyId
            ? {
                key: 'companyId',
                label: `${t('Client')}: ${
                  companies.data?.find((c) => c.id === appliedFilters.companyId)?.name ??
                  appliedFilters.companyId.slice(0, 8)
                }`,
                onClear: () => applyPatch({ companyId: '' }),
              }
            : null,
          appliedFilters.status.trim()
            ? {
                key: 'status',
                label: `${t('Status')}: ${appliedFilters.status}`,
                onClear: () => applyPatch({ status: '' }),
              }
            : null,
          appliedFilters.createdFrom.trim()
            ? {
                key: 'createdFrom',
                label: `${t('Created from')}: ${appliedFilters.createdFrom}`,
                onClear: () => applyPatch({ createdFrom: '' }),
              }
            : null,
          appliedFilters.createdTo.trim()
            ? {
                key: 'createdTo',
                label: `${t('Created to')}: ${appliedFilters.createdTo}`,
                onClear: () => applyPatch({ createdTo: '' }),
              }
            : null,
        ].filter(Boolean) as Array<{ key: string; label: string; onClear: () => void }>}
        onClearAllChips={hasActiveFilters ? resetFilters : undefined}
      >
        <TextField
          label={t('Order #')}
          value={draftFilters.orderSearch}
          onChange={(e) => setDraft({ orderSearch: e.target.value })}
          placeholder={t('Search order...')}
          className="font-mono"
        />
        <Combobox
          label={t('Client')}
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={clientFilterOptions}
          placeholder={t('All clients')}
        />
        <SelectField
          label={t('Status')}
          name="inboundStatusFilter"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={statusFilterOptions}
        />
        <TextField
          label={t('Created from')}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
        />
        <TextField
          label={t('Created to')}
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
        />
      </FilterPanel>

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
    </AdminListPageShell>
  );
}
