import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { OutboundApi, OutboundOrder, OutboundOrderStatus } from '../api/outbound';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button as DsButton } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
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
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { canAccessInternalTransfer } from '../lib/rbac';

type OutListDraft = {
  orderSearch: string;
  companyId: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound orders': 'طلبات الصادر',
    '+ New outbound': '+ صادر جديد',
    'Search order...': 'ابحث عن الطلب...',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
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
    'New outbound order': 'طلب صادر جديد',
    Cancel: 'إلغاء',
    Create: 'إنشاء',
    Back: 'رجوع',
    'Required ship date': 'تاريخ الشحن المطلوب',
    Carrier: 'الناقل',
    Notes: 'ملاحظات',
    'Destination address': 'عنوان الوجهة',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن المطلوب قبل اليوم.',
    'Pick a client.': 'اختر عميلاً.',
    'Enter a destination address.': 'أدخل عنوان الوجهة.',
    'Pick a client…': 'اختر عميلاً…',
    Product: 'المنتج',
    Quantity: 'الكمية',
    Remove: 'إزالة',
    'Pick product…': 'اختر منتجاً…',
    'No lines yet — add a product below.': 'لا توجد بنود بعد — أضف منتجاً أدناه.',
    '+ Add line': '+ إضافة بند',
    'Pick a client first': 'اختر عميلاً أولاً',
    'All clients': 'كل العملاء',
    'All statuses': 'كل الحالات',
    Draft: 'مسودة',
    'Pending approval': 'بانتظار الموافقة',
    'Pending stock': 'بانتظار المخزون',
    Confirmed: 'مؤكد',
    Picking: 'التقاط',
    Packing: 'تغليف',
    'Ready to ship': 'جاهز للشحن',
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
  };
  return ar[label] ?? label;
}

export function OutboundListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const [toCancel, setToCancel] = useState<OutboundOrder | null>(null);
  const [toDelete, setToDelete] = useState<OutboundOrder | null>(null);
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => outboundLabel(label, isArabic);
  const openCreate = () => {
    navigate('/orders/outbound/new');
  };
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<OutListDraft>(
    () => ({
      orderSearch: '',
      companyId: '',
      status: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialList);

  const listParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      companyId: appliedFilters.companyId || undefined,
      status: (appliedFilters.status.trim() || undefined) as OutboundOrderStatus | undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      quickDirectedOnly: false,
    }),
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
      { value: 'pending_stock', label: t('Pending stock') },
      { value: 'confirmed', label: t('Confirmed') },
      { value: 'picking', label: t('Picking') },
      { value: 'packing', label: t('Packing') },
      { value: 'ready_to_ship', label: t('Ready to ship') },
      { value: 'shipped', label: t('Shipped') },
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
      invalidateWorkflowTasksInventory(qc, { referenceId: orderId, referenceType: 'outbound_order' });
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
      actions.push({ key: 'edit', label: t('Edit'), onClick: () => navigate(`/orders/outbound/${o.id}`) });
    }
    if (o.status !== 'shipped' && o.status !== 'cancelled') {
      actions.push({ key: 'cancel', label: t('Cancel order'), danger: true, onClick: () => setToCancel(o) });
    }
    if (isAdmin && o.status === 'cancelled') {
      actions.push({ key: 'delete', label: t('Delete'), danger: true, onClick: () => setToDelete(o) });
    }
    return actions;
  };

  const columns: Column<OutboundOrder>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      { header: t('Client'), accessor: (o) => o.company?.name ?? '—', width: '200px' },
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
        accessor: (o) => <RowActionsMenu items={rowActions(o)} ariaLabel={t('Open actions')} />,
        className: 'w-1 whitespace-nowrap text-center',
        width: '90px',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, isAdmin],
  );

  return (
    <AdminListPageShell
      icon="fa-arrow-up"
      title={t('Outbound orders')}
      isArabic={isArabic}
      actions={
        <DsButton
          variant="primary"
          size="md"
          onClick={openCreate}
          className={FILTER_PRIMARY_BUTTON_CLASS}
        >
          {t('+ New outbound')}
        </DsButton>
      }
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

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
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
          name="outboundStatusFilter"
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
    </AdminListPageShell>
  );
}
