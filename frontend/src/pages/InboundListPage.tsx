import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, Button, Textarea } from '@ds';

import { CompaniesApi } from '../api/companies';
import {
  CreateInboundOrderInput,
  InboundApi,
  InboundOrder,
  InboundOrderStatus,
} from '../api/inbound';
import { Product, ProductsApi } from '../api/products';
import { useAuth } from '../auth/AuthContext';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { OrderDraftLinesTable } from '../components/OrderDraftLinesTable';
import {
  FILTER_PRIMARY_BUTTON_CLASS,
  FILTER_RESET_BUTTON_CLASS,
  FilterPanel,
} from '../components/FilterPanel';
import { Modal } from '../components/Modal';
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
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { canAccessInternalTransfer } from '../lib/rbac';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';

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
  const [open, setOpen] = useState(false);
  const [toCancel, setToCancel] = useState<InboundOrder | null>(null);
  const [toDelete, setToDelete] = useState<InboundOrder | null>(null);
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundLabel(label, isArabic);
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

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
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

  const createMut = useMutation({
    mutationFn: InboundApi.create,
    onSuccess: (order) => {
      toast.success(`Inbound order ${order.orderNumber} created.`);
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      setOpen(false);
      navigate(`/orders/inbound/${order.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
    if (o.status === 'draft' || o.status === 'pending_approval') {
      actions.push({ key: 'edit', label: t('Edit'), onClick: () => navigate(`/orders/inbound/${o.id}`) });
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
              <span className="text-[10px] leading-tight text-amber-800">Missing quantities</span>
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

  return (
    <>
      {!wid && (
        <Alert
          variant="warning"
          title="Warehouse not configured"
          description="The active warehouse could not be resolved. Contact your administrator."
          compact
          className="mb-4"
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
          className="mb-4"
        />
      )}

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        </div>
      </FilterPanel>

      <DataTable
        title={t('Inbound orders')}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setOpen(true)}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('+ New inbound')}
          </Button>
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(o) => o.id}
        loading={pagination.isInitialLoading || !wid}
        onRowClick={(o) => navigate(`/orders/inbound/${o.id}`)}
        empty={wid ? 'No inbound orders match the filters.' : 'Warehouse not resolved yet.'}
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

      <CreateInboundModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
        isArabic={isArabic}
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
    </>
  );
}

interface DraftLine {
  productId: string;
  expectedQuantity: string;
}

function formatProductOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : String(p.totalOnHand ?? '0');
}

interface CreateInboundModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (input: CreateInboundOrderInput) => void;
  isArabic: boolean;
}

function CreateInboundModal({ open, onClose, loading, onSubmit, isArabic }: CreateInboundModalProps) {
  const toast = useToast();
  const t = (label: string) => inboundLabel(label, isArabic);
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [arrival, setArrival] = useState(() => localCalendarDateYmd());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', expectedQuantity: '' }]);
  const [scanOpen, setScanOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
  });

  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: open && !!companyId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (open && !companyId && companies.data?.length) {
      const fallback =
        companies.data.find((c) => c.id === DEFAULT_COMPANY_ID) ?? companies.data[0];
      setCompanyId(fallback.id);
    }
  }, [open, companyId, companies.data]);

  useEffect(() => {
    setLines((prev) => prev.map((l) => ({ ...l, productId: '' })));
  }, [companyId]);

  // Only active products are orderable; suspended/archived rows are rejected by
  // the backend, so keep them out of the create form entirely.
  const orderableProducts = useMemo(
    () => (products.data?.items ?? []).filter((p) => p.status === 'active'),
    [products.data],
  );

  const productOptions = useMemo(
    () =>
      orderableProducts.map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
        hint: `On hand ${formatProductOnHand(p)} ${p.uom}`,
      })),
    [orderableProducts],
  );

  const productsById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of orderableProducts) m.set(p.id, p);
    return m;
  }, [orderableProducts]);

  const tableLines = useMemo(
    () =>
      lines.map((l, idx) => ({
        lineKey: String(idx),
        productId: l.productId,
        quantity: l.expectedQuantity,
      })),
    [lines],
  );

  const reset = () => {
    setCompanyId(DEFAULT_COMPANY_ID);
    setArrival(localCalendarDateYmd());
    setNotes('');
    setLines([{ productId: '', expectedQuantity: '' }]);
    setScanOpen(false);
    setStep(1);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const applyProductByBarcode = async (raw: string) => {
    const code = raw.trim();
    if (!companyId) {
      toast.error('Pick a client first.');
      return;
    }
    if (!code) {
      toast.error('Scan a barcode.');
      return;
    }
    try {
      const { items } = await ProductsApi.list({
        companyId,
        productBarcode: code,
        limit: 50,
      });
      const norm = code.toLowerCase();
      const orderable = items.filter((p) => p.status === 'active');
      const exact = orderable.filter((p) => (p.barcode ?? '').trim().toLowerCase() === norm);
      const product = exact.length === 1 ? exact[0]! : orderable.length === 1 ? orderable[0]! : null;
      if (!product) {
        const suspendedMatch = items.some(
          (p) => p.status !== 'active' && (p.barcode ?? '').trim().toLowerCase() === norm,
        );
        toast.error(
          suspendedMatch
            ? 'This product is suspended and cannot be added to orders.'
            : exact.length > 1
              ? 'Multiple products share this barcode fragment — type a longer code or pick from the list.'
              : 'No product found for this barcode.',
        );
        return;
      }
      setLines((prev) => {
        const emptyIdx = prev.findIndex((l) => !l.productId);
        if (emptyIdx >= 0) {
          return prev.map((l, i) => (i === emptyIdx ? { ...l, productId: product.id } : l));
        }
        return [...prev, { productId: product.id, expectedQuantity: '' }];
      });
      toast.success(`${product.sku} added from barcode.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed.');
    }
  };

  const goToLinesStep = () => {
    if (!companyId.trim()) {
      toast.error(isArabic ? 'اختر عميلاً.' : 'Pick a client.');
      return;
    }
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      toast.error(t('Expected arrival date cannot be before today.'));
      return;
    }
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      toast.error(t('Expected arrival date cannot be before today.'));
      return;
    }
    onSubmit({
      companyId,
      expectedArrivalDate: arrival,
      notes: notes || undefined,
      lines: lines
        .filter((l) => l.productId && l.expectedQuantity)
        .map((l) => ({
          productId: l.productId,
          expectedQuantity: Number(l.expectedQuantity),
        })),
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('New inbound order')}
      widthClass="max-w-3xl"
      footer={
        step === 1 ? (
          <>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleClose}
              disabled={loading}
              className={FILTER_RESET_BUTTON_CLASS}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
              onClick={goToLinesStep}
            >
              {t('Next')}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleClose}
              disabled={loading}
              className={FILTER_RESET_BUTTON_CLASS}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              {t('Back')}
            </Button>
            <Button
              form="create-inbound"
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('Create')}
            </Button>
          </>
        )
      }
    >
      {/* No overflow/max-height here — the Modal's body div is the sole scroll zone. */}
      <form id="create-inbound" onSubmit={submit} className="space-y-4">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Combobox
                label={t('Client')}
                required
                value={companyId}
                onChange={setCompanyId}
                clearable={false}
                dropdownInFlow
                options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                placeholder={isArabic ? 'اختر عميلاً…' : 'Pick a client…'}
              />
              <TextField
                label={t('Expected arrival date')}
                type="date"
                required
                min={localCalendarDateYmd()}
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />
            </div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        ) : (
          <OrderDraftLinesTable
            title={t('Lines')}
            productHeader={t('Product')}
            lines={tableLines}
            productOptions={productOptions}
            productsById={productsById}
            companyId={companyId}
            companyDisabledMessage={isArabic ? 'اختر عميلاً أولاً' : 'Pick a client first'}
            pickProductPlaceholder={t('Pick product…')}
            quantityHeader={t('Quantity')}
            emptyMessage={t('No lines yet — add a product below.')}
            removeLabel={t('Remove')}
            loading={loading}
            formatOnHand={formatProductOnHand}
            onHandLabel={isArabic ? 'الكمية الحالية:' : 'Current quantity:'}
            onUpdateLine={(lineKey, patch) => {
              const idx = Number(lineKey);
              updateLine(idx, {
                ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
                ...(patch.quantity !== undefined ? { expectedQuantity: patch.quantity } : {}),
              });
            }}
            onRemoveLine={(lineKey) => {
              setLines((prev) => prev.filter((_, i) => i !== Number(lineKey)));
            }}
            toolbar={
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!companyId || loading}
                  onClick={() => setScanOpen(true)}
                  aria-label={t('Scan barcode')}
                  title={t('Scan barcode')}
                  className="px-2.5"
                >
                  <BarcodeScanIcon className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }])}
                >
                  {t('+ Add line')}
                </Button>
              </>
            }
          />
        )}
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          void applyProductByBarcode(text);
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </Modal>
  );
}
