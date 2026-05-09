import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ConfirmInboundBody, InboundApi, InboundOrderLine, ReceiveLineInput } from '../api/inbound';
import { LocationsApi } from '../api/locations';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { WorkflowOrderTimeline } from '../components/WorkflowOrderTimeline';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useTaskOnlyMode } from '../hooks/useTaskOnlyMode';
import { generateLotNumber } from '../lib/identifiers';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { inboundHasQuantityShortfall } from '../lib/inbound-shortfall';
import { isReceivingDockLocationType, isStorageLocationType } from '../lib/location-types';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });
function inboundDetailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'All inbound orders': 'جميع طلبات الوارد',
    'Inbound order': 'طلب وارد',
    Client: 'العميل',
    Created: 'تاريخ الإنشاء',
    'Cancel order': 'إلغاء الطلب',
    'Confirm order': 'تأكيد الطلب',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    'Confirmed at': 'تم التأكيد في',
    'Completed at': 'تم الإكمال في',
    Warehouse: 'المستودع',
    SKU: 'رمز الصنف',
    Product: 'المنتج',
    Lot: 'الدفعة',
    Expected: 'المتوقع',
    Action: 'الإجراء',
    Receive: 'استلام',
  };
  return ar[label] ?? label;
}

export function InboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const [receivingLine, setReceivingLine] = useState<InboundOrderLine | null>(null);

  const taskOnlyMode = useTaskOnlyMode();
  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  /** Single receiving dock applied to every line when confirming (task-only workflow). */
  const [receivingDockId, setReceivingDockId] = useState('');
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundDetailLabel(label, isArabic);

  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';

  useEffect(() => {
    setSelectedWarehouseId((cur) =>
      cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId,
    );
  }, [warehouseId, warehouses]);

  useEffect(() => {
    setReceivingDockId('');
  }, [id]);

  const dockLocations = useQuery({
    queryKey: ['locations', 'dock', effectiveWarehouseId] as const,
    queryFn: () => LocationsApi.list(effectiveWarehouseId, false),
    enabled: !!effectiveWarehouseId && taskOnlyMode && !!id,
  });

  const stagingOptions = (dockLocations.data ?? []).filter((l) => isReceivingDockLocationType(l.type));

  const order = useQuery({
    queryKey: [...QK.inboundOrders, id],
    queryFn: () => InboundApi.get(id),
    enabled: !!id,
  });

  const confirmMut = useMutation({
    mutationFn: (body?: ConfirmInboundBody | null) =>
      InboundApi.confirm(id, body === null ? {} : body ?? {}, order.data?.companyId),
    onSuccess: () => {
      toast.success(taskOnlyMode ? 'Order confirmed / workflow started.' : 'Order confirmed.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: id, referenceType: 'inbound_order' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => InboundApi.cancel(id),
    onSuccess: () => {
      toast.success('Order cancelled.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const receiveMut = useMutation({
    mutationFn: (vars: { lineId: string; input: ReceiveLineInput }) =>
      InboundApi.receive(id, vars.lineId, vars.input),
    onSuccess: () => {
      toast.success('Items received and stock updated.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: id, referenceType: 'inbound_order' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!id) return null;
  if (order.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (order.isError || !order.data)
    return <p className="text-sm text-rose-600">Failed to load inbound order.</p>;

  const o = order.data;
  const canConfirm = o.status === 'draft';
  const canCancel = o.status === 'draft' || o.status === 'confirmed';
  const canReceive =
    !taskOnlyMode && ['confirmed', 'in_progress', 'partially_received'].includes(o.status);

  const confirmDisabledTaskOnly =
    taskOnlyMode && canConfirm && (!effectiveWarehouseId || !receivingDockId.trim());

  const lineColumns: Column<InboundOrderLine>[] = [
    { header: '#', accessor: (l) => l.lineNumber, width: '50px' },
    {
      header: t('SKU'),
      accessor: (l) => <span className="font-mono">{l.product?.sku ?? '—'}</span>,
      width: '200px',
    },
    { header: t('Product'), accessor: (l) => l.product?.name ?? '—' },
    {
      header: t('Lot'),
      accessor: (l) => (l.expectedLotNumber ? <span className="font-mono">{l.expectedLotNumber}</span> : '—'),
      width: '180px',
    },
    {
      header: t('Expected'),
      accessor: (l) => <span className="font-mono">{fmtQty(l.expectedQuantity)}</span>,
      width: '100px',
      className: 'text-right',
    },
  ];

  if (!taskOnlyMode) {
    lineColumns.push({
      header: t('Action'),
      accessor: (l) => {
        const rem = Number(l.expectedQuantity) - Number(l.receivedQuantity);
        if (rem <= 0) return <span className="text-xs text-emerald-700">complete</span>;
        return (
          <Button size="sm" disabled={!canReceive} onClick={() => setReceivingLine(l)}>
            {t('Receive')}
          </Button>
        );
      },
      width: '120px',
    });
  }

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/orders/inbound" className="hover:underline">
          ← {t('All inbound orders')}
        </Link>
      </div>
      <PageHeader
        title={o.orderNumber || t('Inbound order')}
        actions={
          <>
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => cancelMut.mutate()}
                loading={cancelMut.isPending}
              >
                {t('Cancel order')}
              </Button>
            )}
            {canConfirm && (
              <Button
                className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
                onClick={() => {
                  if (taskOnlyMode) {
                    const stagingByLineId = Object.fromEntries(
                      o.lines.map((l) => [l.id, receivingDockId.trim()]),
                    );
                    confirmMut.mutate({
                      warehouseId: effectiveWarehouseId,
                      stagingByLineId,
                    });
                  } else {
                    confirmMut.mutate(null);
                  }
                }}
                loading={confirmMut.isPending}
                disabled={confirmDisabledTaskOnly}
              >
                {t('Confirm order')}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <Field label={t('Order #')} value={<span className="font-mono">{o.orderNumber || '—'}</span>} />
        <Field
          label={t('Status')}
          value={
            <div className="space-y-1">
              <StatusBadge status={o.status} />
              {inboundHasQuantityShortfall(o) && o.status === 'partially_received' ? (
                <div className="text-xs text-amber-800">Some lines received below expected quantity.</div>
              ) : null}
              {inboundHasQuantityShortfall(o) && o.status === 'completed' ? (
                <div className="text-xs text-amber-800">Completed with missing quantities on one or more lines.</div>
              ) : null}
            </div>
          }
        />
        <Field label={t('Client')} value={o.company?.name ?? '—'} />
        <Field label={t('Expected arrival')} value={new Date(o.expectedArrivalDate).toLocaleDateString()} />
        <Field label={t('Confirmed at')} value={o.confirmedAt ? new Date(o.confirmedAt).toLocaleString() : '—'} />
        <Field label={t('Completed at')} value={o.completedAt ? new Date(o.completedAt).toLocaleString() : '—'} />
      </div>

      {taskOnlyMode && canConfirm ? (
        <div className="mb-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          {warehouses.length > 1 ? (
            <Combobox
              label="Warehouse for workflow"
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
            <p className="text-xs text-rose-700">Set default warehouse or VITE_DEFAULT_WAREHOUSE_ID.</p>
          ) : (
            <Combobox
              label="Receiving dock"
              required
              value={receivingDockId}
              onChange={setReceivingDockId}
              options={stagingOptions.map((loc) => ({
                value: loc.id,
                label: loc.fullPath,
                hint: loc.barcode,
              }))}
              placeholder="Select receiving dock…"
              emptyMessage={
                stagingOptions.length === 0
                  ? 'No receiving dock locations (type input). Create one under Locations.'
                  : 'No locations.'
              }
            />
          )}
        </div>
      ) : null}

      <WorkflowOrderTimeline
        referenceType="inbound_order"
        referenceId={id}
        enabled={!!id && o.status !== 'draft'}
        companyIdOverride={o.companyId}
      />

      <DataTable columns={lineColumns} rows={o.lines} rowKey={(l) => l.id} />

      {!taskOnlyMode && (
        <ReceiveModal
          line={receivingLine}
          loading={receiveMut.isPending}
          onClose={() => setReceivingLine(null)}
          onSubmit={(input) =>
            receivingLine && receiveMut.mutate({ lineId: receivingLine.id, input })
          }
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value}</div>
    </div>
  );
}

interface ReceiveModalProps {
  line: InboundOrderLine | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: ReceiveLineInput) => void;
}

function ReceiveModal({ line, loading, onClose, onSubmit }: ReceiveModalProps) {
  const [quantity, setQuantity] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [overrideLot, setOverrideLot] = useState(false);
  const [advancedEdit, setAdvancedEdit] = useState(false);

  const locations = useQuery({
    queryKey: QK.locationsFlatAll(false),
    queryFn: () => LocationsApi.list(undefined, false),
    enabled: !!line,
  });

  const isLot = line?.product?.trackingType === 'lot';
  const expectedLot = line?.expectedLotNumber?.trim() || '';
  const lotLocked = isLot && !!expectedLot && !overrideLot;
  const showExpiry = isLot && (line?.product?.expiryTracking ?? false);
  const expectedExpiry = line?.expectedExpiryDate;

  useEffect(() => {
    if (line) {
      setLotNumber(expectedLot);
      setOverrideLot(false);
      setAdvancedEdit(false);
      setQuantity('');
      setLocationId('');
      setExpiry(expectedExpiry ? expectedExpiry.slice(0, 10) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const close = () => {
    if (loading) return;
    onClose();
  };

  const storageLocations = (locations.data ?? []).filter((l) => isStorageLocationType(l.type));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!line) return;

    const q = Number(quantity);
    const base: ReceiveLineInput = { quantity: q, locationId };

    if (!isLot) {
      onSubmit(base);
      return;
    }

    const useServerLotExpiry =
      !!expectedLot && lotLocked && !overrideLot && !advancedEdit;

    if (useServerLotExpiry) {
      onSubmit(base);
      return;
    }

    const ln = lotNumber.trim();
    if (!ln) return;

    let override = false;
    if (overrideLot && expectedLot && ln !== expectedLot) override = true;
    if (!overrideLot && advancedEdit && expectedLot && ln !== expectedLot) override = true;

    const next: ReceiveLineInput = {
      ...base,
      lotNumber: ln,
      ...(override ? { overrideLot: true as const } : {}),
    };

    if (showExpiry) {
      if (advancedEdit || !expectedExpiry) {
        if (!expiry.trim()) return;
        next.expiryDate = expiry.trim();
      }
    }

    onSubmit(next);
  };

  if (!line) return null;
  const remaining = Number(line.expectedQuantity) - Number(line.receivedQuantity);

  const showEditableExpiry =
    showExpiry && (advancedEdit || !expectedExpiry || overrideLot);

  return (
    <Modal
      open={!!line}
      onClose={close}
      title={`Receive ${line.product?.sku ?? ''}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button form="receive" type="submit" loading={loading}>
            Receive
          </Button>
        </>
      }
    >
      <form id="receive" onSubmit={submit} className="space-y-3">
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <div>Expected: {fmtQty(line.expectedQuantity)}</div>
          <div>Received so far: {fmtQty(line.receivedQuantity)}</div>
          <div>Remaining: {remaining.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        </div>

        <TextField
          label="Quantity to receive"
          type="number"
          min={0}
          step="0.0001"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          hint="Database trigger blocks > 110% of expected."
        />

        <Combobox
          label="Destination location"
          required
          value={locationId}
          onChange={setLocationId}
          options={storageLocations.map((l) => ({
            value: l.id,
            label: l.fullPath,
            hint: l.barcode,
          }))}
          placeholder="Pick a storage location…"
          hint="Non-storage nodes (e.g. ISS aisles, docks) are hidden."
          emptyMessage="No eligible storage locations"
        />

        {isLot && (
          <div className="space-y-2">
            {expectedLot && (
              <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <span className="font-medium text-slate-500">Expected lot:</span>{' '}
                <span className="font-mono">{expectedLot}</span>
              </div>
            )}
            {showExpiry && expectedExpiry && !advancedEdit && !overrideLot && (
              <div className="rounded border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                <span className="font-medium">Expected expiry:</span>{' '}
                <span>{new Date(expectedExpiry).toLocaleDateString()}</span>
                {' — '}used automatically unless you unlock editing.
              </div>
            )}

            {(expectedLot || (showExpiry && !!expectedExpiry)) && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={advancedEdit}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAdvancedEdit(on);
                    if (!on && expectedLot) setLotNumber(expectedLot);
                  }}
                />
                Edit lot / expiry manually
              </label>
            )}

            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <TextField
                label={
                  advancedEdit ? 'Lot number' : lotLocked ? 'Lot number (from order)' : 'Lot number'
                }
                required
                disabled={lotLocked && !advancedEdit}
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
              {expectedLot ? (
                <Button
                  type="button"
                  size="sm"
                  variant={overrideLot ? 'primary' : 'secondary'}
                  onClick={() => {
                    const next = !overrideLot;
                    setOverrideLot(next);
                    if (!next) {
                      setLotNumber(expectedLot);
                      setAdvancedEdit(false);
                    }
                  }}
                  title={overrideLot ? 'Revert to locked expected lot' : 'Override locked lot number'}
                >
                  {overrideLot ? 'Use expected lot' : 'Override Lot Number'}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setLotNumber(generateLotNumber())}
                >
                  Generate
                </Button>
              )}
            </div>

            {showExpiry && (
              <TextField
                label={
                  advancedEdit || !expectedExpiry
                    ? 'Expiry date'
                    : 'Expiry date (shown for reference — unlock to change)'
                }
                type="date"
                required={showEditableExpiry}
                disabled={showExpiry && !!expectedExpiry && !advancedEdit && !overrideLot}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
