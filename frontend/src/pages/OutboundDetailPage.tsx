import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { OutboundApi, OutboundOrderLine, type ConfirmOutboundBody } from '../api/outbound';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { Combobox } from '../components/Combobox';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { WorkflowNextRunnableCard } from '../components/WorkflowNextRunnableCard';
import { WorkflowOrderTimeline } from '../components/WorkflowOrderTimeline';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useTaskOnlyMode } from '../hooks/useTaskOnlyMode';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });

export function OutboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const taskOnlyMode = useTaskOnlyMode();
  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

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
    mutationFn: (body: ConfirmOutboundBody) => OutboundApi.confirm(id, body),
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

  if (!id) return null;
  if (order.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (order.isError || !order.data)
    return <p className="text-sm text-rose-600">Failed to load outbound order.</p>;

  const o = order.data;
  const canConfirm = o.status === 'draft';
  const canCancel = o.status === 'draft';
  const outboundConfirmBlocked = taskOnlyMode && canConfirm && !effectiveWarehouseId;

  const lineColumns: Column<OutboundOrderLine>[] = [
    { header: '#', accessor: (l) => l.lineNumber, width: '50px' },
    {
      header: 'SKU',
      accessor: (l) => <span className="font-mono">{l.product?.sku ?? '—'}</span>,
      width: '200px',
    },
    { header: 'Product', accessor: (l) => l.product?.name ?? '—' },
    { header: 'Tracking', accessor: (l) => l.product?.trackingType ?? '—', width: '110px' },
    {
      header: 'Requested',
      accessor: (l) => <span className="font-mono">{fmtQty(l.requestedQuantity)}</span>,
      width: '120px',
      className: 'text-right',
    },
    {
      header: 'Picked',
      accessor: (l) => <span className="font-mono">{fmtQty(l.pickedQuantity)}</span>,
      width: '120px',
      className: 'text-right',
    },
    { header: 'Status', accessor: (l) => <StatusBadge status={l.status} />, width: '110px' },
  ];

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/outbound" className="hover:underline">
          ← All outbound orders
        </Link>
      </div>
      <PageHeader
        title={o.orderNumber || 'Outbound order'}
        description={`Client: ${o.company?.name ?? '—'} • Created ${new Date(o.createdAt).toLocaleString()}`}
        actions={
          <>
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => cancelMut.mutate()}
                loading={cancelMut.isPending}
              >
                Cancel order
              </Button>
            )}
            {canConfirm && (
              <Button
                onClick={() =>
                  confirmMut.mutate(
                    taskOnlyMode ? { warehouseId: effectiveWarehouseId } : {},
                  )
                }
                loading={confirmMut.isPending}
                disabled={outboundConfirmBlocked}
              >
                {taskOnlyMode ? 'Confirm & start workflow' : 'Confirm & deduct stock'}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <Field label="Order #" value={<span className="font-mono">{o.orderNumber || '—'}</span>} />
        <Field label="Status" value={<StatusBadge status={o.status} />} />
        <Field label="Client" value={o.company?.name ?? '—'} />
        <Field label="Required ship" value={new Date(o.requiredShipDate).toLocaleDateString()} />
        <Field label="Carrier" value={o.carrier ?? '—'} />
        <Field label="Shipped at" value={o.shippedAt ? new Date(o.shippedAt).toLocaleString() : '—'} />
        <Field label="Destination" value={o.destinationAddress} />
      </div>

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

      {taskOnlyMode ? (
        <WorkflowNextRunnableCard
          referenceType="outbound_order"
          referenceId={id}
          enabled={!!id}
          isDraftOrder={o.status === 'draft'}
        />
      ) : (
        <WorkflowOrderTimeline
          referenceType="outbound_order"
          referenceId={id}
          enabled={!!id && o.status !== 'draft'}
        />
      )}

      <DataTable columns={lineColumns} rows={o.lines} rowKey={(l) => l.id} />

      {o.status === 'draft' ? (
        <p className="mt-3 text-xs text-slate-500">
          {taskOnlyMode
            ? 'Order page is view-only; execution is on warehouse task pages.'
            : 'Confirming atomically allocates stock FEFO and ships in one legacy transaction unless stock is insufficient.'}
        </p>
      ) : null}
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
