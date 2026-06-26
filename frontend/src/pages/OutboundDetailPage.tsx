import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { OutboundApi, OutboundOrderLine, type ConfirmOutboundBody } from '../api/outbound';
import { Button } from '@ds';

import { useAuth } from '../auth/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { Combobox } from '../components/Combobox';
import { FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS, FilterPanel } from '../components/FilterPanel';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { WorkflowOrderTimeline } from '../components/WorkflowOrderTimeline';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useTaskOnlyMode } from '../hooks/useTaskOnlyMode';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { canAccessInternalTransfer } from '../lib/rbac';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });
function outboundDetailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'All outbound orders': 'جميع طلبات الصادر',
    'Outbound order': 'طلب صادر',
    'Order details': 'تفاصيل الطلب',
    Client: 'العميل',
    Created: 'تاريخ الإنشاء',
    'Cancel order': 'إلغاء الطلب',
    'Delete order': 'حذف الطلب',
    'Delete this order?': 'حذف هذا الطلب؟',
    'This permanently removes the order and its lines. This action cannot be undone.':
      'سيؤدي هذا إلى حذف الطلب وبنوده نهائياً. لا يمكن التراجع عن هذا الإجراء.',
    Delete: 'حذف',
    Cancel: 'إلغاء',
    'Order deleted.': 'تم حذف الطلب.',
    'Confirm & start workflow': 'تأكيد وبدء سير العمل',
    'Confirm & deduct stock': 'تأكيد وخصم المخزون',
    'Approve order': 'اعتماد الطلب',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Required ship': 'الشحن المطلوب',
    Carrier: 'الناقل',
    'Shipped at': 'تم الشحن في',
    Destination: 'الوجهة',
    SKU: 'رمز الصنف',
    Product: 'المنتج',
    Tracking: 'التتبع',
    Requested: 'المطلوب',
    Picked: 'تم التقاطه',
  };
  return ar[label] ?? label;
}

export function OutboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const taskOnlyMode = useTaskOnlyMode();
  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => outboundDetailLabel(label, isArabic);

  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';

  useEffect(() => {
    setSelectedWarehouseId((cur) =>
      cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId,
    );
  }, [warehouseId, warehouses]);

  const order = useQuery({
    queryKey: [...QK.outboundOrders, id],
    queryFn: () => OutboundApi.get(id),
    enabled: !!id,
  });

  const confirmMut = useMutation({
    mutationFn: (body: ConfirmOutboundBody) => OutboundApi.confirm(id, body, order.data?.companyId),
    onSuccess: () => {
      toast.success(
        taskOnlyMode
          ? 'Order confirmed — picking workflow started.'
          : 'Stock deducted; order shipped.',
      );
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: id, referenceType: 'outbound_order' });
      if (!taskOnlyMode) {
        qc.invalidateQueries({ queryKey: QK.inventoryStock });
        qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
        qc.invalidateQueries({ queryKey: QK.ledger });
      }
      qc.invalidateQueries({ queryKey: QK.workflows.timeline('outbound_order', id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => OutboundApi.cancel(id),
    onSuccess: () => {
      toast.success('Order cancelled.');
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => OutboundApi.remove(id),
    onSuccess: () => {
      toast.success(t('Order deleted.'));
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      navigate('/orders/outbound');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!id) return null;
  if (order.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (order.isError || !order.data)
    return <p className="text-sm text-rose-600">Failed to load outbound order.</p>;

  const o = order.data;
  const canConfirm = o.status === 'draft' || o.status === 'pending_approval';
  const canCancel = o.status === 'draft' || o.status === 'pending_approval';
  const canDelete =
    isAdmin && ['draft', 'pending_approval', 'cancelled'].includes(o.status);
  const outboundConfirmBlocked = taskOnlyMode && canConfirm && !effectiveWarehouseId;

  const lineColumns: Column<OutboundOrderLine>[] = [
    { header: '#', accessor: (l) => l.lineNumber, width: '50px' },
    {
      header: t('SKU'),
      accessor: (l) => <span className="font-mono">{l.product?.sku ?? '—'}</span>,
      width: '200px',
    },
    { header: t('Product'), accessor: (l) => l.product?.name ?? '—' },
    { header: t('Tracking'), accessor: (l) => l.product?.trackingType ?? '—', width: '110px' },
    {
      header: t('Requested'),
      accessor: (l) => <span className="font-mono">{fmtQty(l.requestedQuantity)}</span>,
      width: '120px',
      className: 'text-right',
    },
    {
      header: t('Picked'),
      accessor: (l) => <span className="font-mono">{fmtQty(l.pickedQuantity)}</span>,
      width: '120px',
      className: 'text-right',
    },
    { header: t('Status'), accessor: (l) => <StatusBadge status={l.status} />, width: '110px' },
  ];

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/orders/outbound" className="hover:underline">
          ← {t('All outbound orders')}
        </Link>
      </div>
      <FilterPanel
        title={t('Order details')}
        headerActions={
          canCancel || canConfirm || canDelete ? (
            <>
              {canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => setDeleteOpen(true)}
                  loading={deleteMut.isPending}
                  className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {t('Delete order')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => cancelMut.mutate()}
                  loading={cancelMut.isPending}
                  className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {t('Cancel order')}
                </Button>
              ) : null}
              {canConfirm ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() =>
                    confirmMut.mutate(
                      taskOnlyMode ? { warehouseId: effectiveWarehouseId } : {},
                    )
                  }
                  loading={confirmMut.isPending}
                  disabled={outboundConfirmBlocked}
                  className={`${FILTER_APPLY_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {o.status === 'pending_approval'
                    ? t('Approve order')
                    : taskOnlyMode
                      ? t('Confirm & start workflow')
                      : t('Confirm & deduct stock')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Field label={t('Order #')} value={<span className="font-mono">{o.orderNumber || '—'}</span>} />
          <Field label={t('Status')} value={<StatusBadge status={o.status} />} />
          <Field label={t('Client')} value={o.company?.name ?? '—'} />
          <Field label={t('Required ship')} value={new Date(o.requiredShipDate).toLocaleDateString()} />
          <Field label={t('Carrier')} value={o.carrier ?? '—'} />
          <Field label={t('Shipped at')} value={o.shippedAt ? new Date(o.shippedAt).toLocaleString() : '—'} />
          <Field label={t('Destination')} value={o.destinationAddress} />
        </div>
      </FilterPanel>

      {taskOnlyMode && canConfirm ? (
        <div className="mb-4 space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
          <div className="font-medium">Task-driven outbound</div>
          <p className="text-xs text-amber-900/90">
            Confirm starts pick → pack → dispatch tasks only. Stock is deducted when dispatch completes —
            not on confirm.
          </p>
          {warehouses.length > 1 ? (
            <Combobox
              label="Warehouse"
              required
              value={selectedWarehouseId || warehouseId}
              onChange={setSelectedWarehouseId}
              options={warehouses
                .filter((w) => w.status === 'active')
                .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
              placeholder="Select warehouse…"
            />
          ) : null}
          {!effectiveWarehouseId ? (
            <p className="text-xs text-rose-700">
              Resolve a warehouse (default warehouse or VITE_DEFAULT_WAREHOUSE_ID).
            </p>
          ) : null}
        </div>
      ) : null}

      <WorkflowOrderTimeline
        referenceType="outbound_order"
        referenceId={id}
        enabled={!!id && o.status !== 'draft'}
        companyIdOverride={o.companyId}
      />

      <DataTable columns={lineColumns} rows={o.lines} rowKey={(l) => l.id} />

      {o.status === 'draft' && !taskOnlyMode ? (
        <p className="mt-3 text-xs text-slate-500">
          Confirming atomically allocates stock FEFO and ships in one legacy transaction unless stock is insufficient.
        </p>
      ) : null}

      <ConfirmModal
        open={deleteOpen}
        title={t('Delete this order?')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      >
        <p className="text-sm">
          {t('This permanently removes the order and its lines. This action cannot be undone.')}
        </p>
      </ConfirmModal>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value}</div>
    </div>
  );
}
