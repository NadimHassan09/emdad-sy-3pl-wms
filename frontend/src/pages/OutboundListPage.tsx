import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi } from '../api/inventory';
import { CreateOutboundOrderInput, OutboundApi, OutboundOrder, OutboundOrderStatus } from '../api/outbound';
import type { Product } from '../api/products';
import { ProductsApi } from '../api/products';
import { useAuth } from '../auth/AuthContext';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { OrderDraftLinesTable } from '../components/OrderDraftLinesTable';
import { Alert, Button as DsButton } from '@ds';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
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
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { canAccessInternalTransfer } from '../lib/rbac';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';

function formatProductOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : String(p.totalOnHand ?? '0');
}

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
  const [open, setOpen] = useState(false);
  const [toCancel, setToCancel] = useState<OutboundOrder | null>(null);
  const [toDelete, setToDelete] = useState<OutboundOrder | null>(null);
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => outboundLabel(label, isArabic);
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

  const createMut = useMutation({
    mutationFn: OutboundApi.create,
    onSuccess: (order) => {
      toast.success(`Outbound order ${order.orderNumber} created.`);
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      setOpen(false);
      navigate(`/orders/outbound/${order.id}`);
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.message);
    },
  });

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
    <>
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
      </div>
      </FilterPanel>

      <DataTable
        title={t('Outbound orders')}
        actions={
          <DsButton
            variant="primary"
            size="md"
            onClick={() => setOpen(true)}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('+ New outbound')}
          </DsButton>
        }
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

      <CreateOutboundModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        isArabic={isArabic}
        onSubmit={(input) => createMut.mutate(input)}
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
    </>
  );
}

interface DraftLine {
  productId: string;
  requestedQuantity: string;
}

interface CreateOutboundModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  isArabic: boolean;
  onSubmit: (input: CreateOutboundOrderInput) => void;
}

function CreateOutboundModal({ open, onClose, loading, isArabic, onSubmit }: CreateOutboundModalProps) {
  const toast = useToast();
  const t = (label: string) => outboundLabel(label, isArabic);
  const [step, setStep] = useState<1 | 2>(1);
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresPacking, setRequiresPacking] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', requestedQuantity: '' }]);
  const [scanOpen, setScanOpen] = useState(false);

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
        hint: `${p.uom} · on hand ${formatProductOnHand(p)}`,
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
        quantity: l.requestedQuantity,
      })),
    [lines],
  );

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: QK.availability(pid, companyId),
      queryFn: () => InventoryApi.availability(pid, companyId),
      enabled: open && !!pid && !!companyId,
      staleTime: 10_000,
    })),
  });
  const availabilityByProduct = useMemo(() => {
    const m = new Map<string, number>();
    distinctProductIds.forEach((pid, i) => {
      const r = availabilityResults[i]?.data;
      if (r) m.set(pid, Number(r.available));
    });
    return m;
  }, [availabilityResults, distinctProductIds]);

  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (!l.productId) continue;
      const n = Number(l.requestedQuantity);
      if (!Number.isFinite(n) || n <= 0) continue;
      m.set(l.productId, (m.get(l.productId) ?? 0) + n);
    }
    return m;
  }, [lines]);

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = [];
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid);
      if (avail !== undefined && qty > avail) {
        out.push({ productId: pid, requested: qty, available: avail });
      }
    });
    return out;
  }, [availabilityByProduct, requestedByProduct]);

  const reset = () => {
    setCompanyId(DEFAULT_COMPANY_ID);
    setShipDate(localCalendarDateYmd());
    setDestination('');
    setCarrier('');
    setNotes('');
    setRequiresPacking(true);
    setLines([{ productId: '', requestedQuantity: '' }]);
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
      toast.error('Enter or scan a barcode.');
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
        return [...prev, { productId: product.id, requestedQuantity: '' }];
      });
      toast.success(`${product.sku} added from barcode.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed.');
    }
  };

  const goToLinesStep = () => {
    if (!companyId.trim()) {
      toast.error(t('Pick a client.'));
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      toast.error(t('Required ship date cannot be before today.'));
      return;
    }
    if (!destination.trim()) {
      toast.error(t('Enter a destination address.'));
      return;
    }
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;
    if (shortages.length > 0) {
      toast.error('Insufficient stock for one or more products.');
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      toast.error(t('Required ship date cannot be before today.'));
      return;
    }
    onSubmit({
      companyId,
      destinationAddress: destination,
      requiredShipDate: shipDate,
      carrier: carrier || undefined,
      notes: notes || undefined,
      requiresPacking,
      lines: lines
        .filter((l) => l.productId && l.requestedQuantity)
        .map((l) => ({ productId: l.productId, requestedQuantity: Number(l.requestedQuantity) })),
    });
  };

  const submitDisabled = shortages.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('New outbound order')}
      widthClass="max-w-3xl"
      footer={
        step === 1 ? (
          <>
            <DsButton
              type="button"
              variant="danger"
              size="md"
              onClick={handleClose}
              disabled={loading}
              className={FILTER_RESET_BUTTON_CLASS}
            >
              {t('Cancel')}
            </DsButton>
            <DsButton
              type="button"
              variant="primary"
              size="md"
              disabled={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
              onClick={goToLinesStep}
            >
              {t('Next')}
            </DsButton>
          </>
        ) : (
          <>
            <DsButton
              type="button"
              variant="danger"
              size="md"
              onClick={handleClose}
              disabled={loading}
              className={FILTER_RESET_BUTTON_CLASS}
            >
              {t('Cancel')}
            </DsButton>
            <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={loading}>
              {t('Back')}
            </Button>
            <DsButton
              form="create-outbound"
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={submitDisabled}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('Create')}
            </DsButton>
          </>
        )
      }
    >
      <form id="create-outbound" onSubmit={submit} className="space-y-4">
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
                placeholder={t('Pick a client…')}
              />
              <TextField
                label={t('Required ship date')}
                type="date"
                required
                min={localCalendarDateYmd()}
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label={t('Carrier')}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
              <TextField label={t('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <TextField
              label={t('Destination address')}
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <input
                type="checkbox"
                checked={requiresPacking}
                onChange={(e) => setRequiresPacking(e.target.checked)}
                className="mt-1 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-900">{t('Packing')}</span>
            </label>
          </div>
        ) : (
          <>
            <OrderDraftLinesTable
              title={t('Lines')}
              productHeader={t('Product')}
              lines={tableLines}
              productOptions={productOptions}
              productsById={productsById}
              companyId={companyId}
              companyDisabledMessage={t('Pick a client first')}
              pickProductPlaceholder={t('Pick product…')}
              quantityHeader={t('Quantity')}
              emptyMessage={t('No lines yet — add a product below.')}
              removeLabel={t('Remove')}
              loading={loading}
              showProductOnHand={false}
              formatOnHand={formatProductOnHand}
              onHandLabel=""
              renderProductFooter={(productId) => {
                const avail = availabilityByProduct.get(productId);
                const summed = requestedByProduct.get(productId) ?? 0;
                if (avail === undefined) return null;
                const isShort = summed > avail;
                return (
                  <div className={`mt-1 text-xs ${isShort ? 'text-rose-600' : 'text-emerald-700'}`}>
                    Available: {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    {summed > 0 && (
                      <>
                        {' '}
                        • Requested across lines:{' '}
                        {summed.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </>
                    )}
                  </div>
                );
              }}
              quantityError={(row) => {
                if (!row.productId) return undefined;
                const avail = availabilityByProduct.get(row.productId);
                const summed = requestedByProduct.get(row.productId) ?? 0;
                if (avail !== undefined && summed > avail) return 'Exceeds available stock';
                return undefined;
              }}
              onUpdateLine={(lineKey, patch) => {
                const idx = Number(lineKey);
                updateLine(idx, {
                  ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
                  ...(patch.quantity !== undefined ? { requestedQuantity: patch.quantity } : {}),
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
                    aria-label="Scan barcode"
                    title="Scan a barcode with the device camera"
                    className="px-2.5"
                  >
                    <BarcodeScanIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() =>
                      setLines((prev) => [...prev, { productId: '', requestedQuantity: '' }])
                    }
                  >
                    {t('+ Add line')}
                  </Button>
                </>
              }
            />
            {shortages.length > 0 && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <strong className="block">Order cannot be created — insufficient stock:</strong>
                <ul className="mt-1 list-disc pl-4">
                  {shortages.map((s) => {
                    const p = products.data?.items.find((x) => x.id === s.productId);
                    return (
                      <li key={s.productId}>
                        {p ? `${p.sku} — ${p.name}` : s.productId}: requested {s.requested}, available{' '}
                        {s.available}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          void applyProductByBarcode(text);
          setScanOpen(false);
        }}
      />
    </Modal>
  );
}
