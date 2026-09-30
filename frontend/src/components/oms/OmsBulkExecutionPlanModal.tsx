import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OmsOrderListItem } from '../../api/oms';
import { LocationsApi } from '../../api/locations';
import { WarehousesApi } from '../../api/warehouses';
import type { BulkProcessOutboundItem } from '../../api/outbound';
import { Modal } from '../Modal';
import { QK } from '../../constants/query-keys';

type Props = {
  open: boolean;
  selectedOrders: OmsOrderListItem[];
  onClose: () => void;
  onConfirm: (items: BulkProcessOutboundItem[]) => void;
  loading: boolean;
};

/** Per-order config row in the execution plan table. */
type RowConfig = {
  outboundOrderId: string;
  orderNumber: string;
  omsOrderNumber: string;
  executionMode: 'admin' | 'workers';
  requiresPacking: boolean;
  warehouseId: string;
  packingLocationId: string;
  dispatchDockId: string;
  eligible: boolean;
  ineligibleReason?: string;
};

const FIELD_CLASS =
  'block w-full rounded-md border border-border-base bg-surface-base px-2 py-1.5 text-xs text-text-strong focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50';

const ELIGIBLE_STATUSES = [
  'pending_approval',
  'confirmed_waiting_for_admin_approval',
  'pending',
  'confirmed',
  'approved',
];

export function OmsBulkExecutionPlanModal({
  open,
  selectedOrders,
  onClose,
  onConfirm,
  loading,
}: Props) {
  const warehousesQuery = useQuery({
    queryKey: QK.warehouses,
    queryFn: () => WarehousesApi.list(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const firstWarehouseId = warehousesQuery.data?.[0]?.id ?? '';

  const [globalWarehouseId, setGlobalWarehouseId] = useState('');
  const [globalDispatchDock, setGlobalDispatchDock] = useState('');
  const [globalPackingLocation, setGlobalPackingLocation] = useState('');
  const [globalExecutionMode, setGlobalExecutionMode] = useState<'admin' | 'workers'>('admin');
  const [globalRequiresPacking, setGlobalRequiresPacking] = useState(false);

  // Packing and dock locations
  const locationsQuery = useQuery({
    queryKey: ['locations-for-bulk-plan', globalWarehouseId || firstWarehouseId],
    queryFn: () =>
      LocationsApi.listChildren({
        warehouseId: globalWarehouseId || firstWarehouseId,
        limit: 200,
      }),
    enabled: open && !!(globalWarehouseId || firstWarehouseId),
    staleTime: 2 * 60_000,
  });
  const packingLocations = useMemo(
    () => (locationsQuery.data?.items ?? []).filter((l) => l.type === 'packing'),
    [locationsQuery.data],
  );
  const dispatchDocks = useMemo(
    () => (locationsQuery.data?.items ?? []).filter((l) => (l as unknown as { type: string }).type === 'dispatch' || (l as unknown as { type: string }).type === 'dock'),
    [locationsQuery.data],
  );

  const [rows, setRows] = useState<RowConfig[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      selectedOrders.map((order) => {
        const outboundOrderId = order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? '';
        const eligible = ELIGIBLE_STATUSES.includes(order.status) && !!outboundOrderId;
        return {
          outboundOrderId,
          orderNumber: order.orderNumber,
          omsOrderNumber: order.orderNumber,
          executionMode: 'admin',
          requiresPacking: false,
          warehouseId: firstWarehouseId,
          packingLocationId: '',
          dispatchDockId: '',
          eligible,
          ineligibleReason: !outboundOrderId
            ? 'No linked outbound order'
            : !ELIGIBLE_STATUSES.includes(order.status)
            ? `Status "${order.status}" is not processable`
            : undefined,
        };
      }),
    );
    // Reset globals on open
    setGlobalWarehouseId('');
    setGlobalDispatchDock('');
    setGlobalPackingLocation('');
    setGlobalExecutionMode('admin');
    setGlobalRequiresPacking(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedOrders]);

  // Apply globals to all eligible rows
  const applyGlobals = () => {
    setRows((prev) =>
      prev.map((r) =>
        !r.eligible
          ? r
          : {
              ...r,
              executionMode: globalExecutionMode,
              requiresPacking: globalRequiresPacking,
              warehouseId: globalWarehouseId || r.warehouseId,
              dispatchDockId: globalDispatchDock || r.dispatchDockId,
              packingLocationId:
                globalRequiresPacking && globalPackingLocation
                  ? globalPackingLocation
                  : r.packingLocationId,
            },
      ),
    );
  };

  const updateRow = (outboundOrderId: string, patch: Partial<RowConfig>) => {
    setRows((prev) =>
      prev.map((r) => (r.outboundOrderId === outboundOrderId ? { ...r, ...patch } : r)),
    );
  };

  const eligibleRows = rows.filter((r) => r.eligible);
  const ineligibleRows = rows.filter((r) => !r.eligible);

  const canConfirm =
    eligibleRows.length > 0 &&
    eligibleRows.every(
      (r) =>
        r.warehouseId.trim() &&
        r.dispatchDockId.trim() &&
        (!r.requiresPacking || r.packingLocationId.trim()),
    );

  const handleConfirm = () => {
    const items: BulkProcessOutboundItem[] = eligibleRows.map((r) => ({
      outboundOrderId: r.outboundOrderId,
      executionMode: r.executionMode,
      requiresPacking: r.requiresPacking,
      warehouseId: r.warehouseId.trim(),
      dispatchDockId: r.dispatchDockId.trim(),
      ...(r.requiresPacking && r.packingLocationId.trim()
        ? { packingLocationId: r.packingLocationId.trim() }
        : {}),
    }));
    onConfirm(items);
  };

  const warehouses = warehousesQuery.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Bulk Process Orders">
      <div className="flex flex-col gap-5 p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-strong">Bulk Process Orders</h2>
            <p className="text-sm text-text-muted mt-0.5">
              Review and configure the execution plan for each order before confirming.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="rounded p-1 hover:bg-surface-hover text-text-faint disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Global settings */}
        <div className="rounded-lg border border-border-base bg-surface-muted p-4 shrink-0">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
            Apply to all eligible orders
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Mode</label>
              <select
                value={globalExecutionMode}
                onChange={(e) => setGlobalExecutionMode(e.target.value as 'admin' | 'workers')}
                className={FIELD_CLASS}
              >
                <option value="admin">Admin</option>
                <option value="workers">Workers</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalRequiresPacking}
                  onChange={(e) => setGlobalRequiresPacking(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
                />
                Requires Packing
              </label>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Warehouse</label>
              <select
                value={globalWarehouseId}
                onChange={(e) => setGlobalWarehouseId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">— pick —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Dispatch Dock</label>
              <select
                value={globalDispatchDock}
                onChange={(e) => setGlobalDispatchDock(e.target.value)}
                className={FIELD_CLASS}
                disabled={!dispatchDocks.length}
              >
                <option value="">— pick —</option>
                {dispatchDocks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            {globalRequiresPacking && (
              <div>
                <label className="text-xs text-text-muted mb-1 block">Packing Location</label>
                <select
                  value={globalPackingLocation}
                  onChange={(e) => setGlobalPackingLocation(e.target.value)}
                  className={FIELD_CLASS}
                  disabled={!packingLocations.length}
                >
                  <option value="">— pick —</option>
                  {packingLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button
            onClick={applyGlobals}
            className="mt-3 text-xs rounded px-3 py-1.5 bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            Apply to all eligible
          </button>
        </div>

        {/* Per-order table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Eligible rows */}
          {eligibleRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border-base">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Order #</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Mode</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Packing</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Warehouse</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Dispatch Dock</th>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Pack Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base bg-surface-base">
                  {eligibleRows.map((row) => (
                    <tr key={row.outboundOrderId}>
                      <td className="px-3 py-2 font-medium text-text-strong whitespace-nowrap">
                        {row.omsOrderNumber}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.executionMode}
                          onChange={(e) =>
                            updateRow(row.outboundOrderId, {
                              executionMode: e.target.value as 'admin' | 'workers',
                            })
                          }
                          className={FIELD_CLASS}
                        >
                          <option value="admin">Admin</option>
                          <option value="workers">Workers</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.requiresPacking}
                          onChange={(e) =>
                            updateRow(row.outboundOrderId, {
                              requiresPacking: e.target.checked,
                              packingLocationId: e.target.checked ? row.packingLocationId : '',
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-border-strong text-brand focus:ring-brand"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.warehouseId}
                          onChange={(e) =>
                            updateRow(row.outboundOrderId, { warehouseId: e.target.value })
                          }
                          className={FIELD_CLASS}
                        >
                          <option value="">— required —</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.dispatchDockId}
                          onChange={(e) =>
                            updateRow(row.outboundOrderId, { dispatchDockId: e.target.value })
                          }
                          className={FIELD_CLASS}
                        >
                          <option value="">— required —</option>
                          {dispatchDocks.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {row.requiresPacking ? (
                          <select
                            value={row.packingLocationId}
                            onChange={(e) =>
                              updateRow(row.outboundOrderId, {
                                packingLocationId: e.target.value,
                              })
                            }
                            className={FIELD_CLASS}
                          >
                            <option value="">— required —</option>
                            {packingLocations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ineligible rows */}
          {ineligibleRows.length > 0 && (
            <div className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
              <p className="text-xs font-semibold text-status-warning-fg mb-2">
                {ineligibleRows.length} order(s) will be skipped:
              </p>
              <ul className="space-y-1">
                {ineligibleRows.map((r) => (
                  <li key={r.orderNumber} className="text-xs text-status-warning-fg">
                    <span className="font-medium">{r.omsOrderNumber}</span> —{' '}
                    {r.ineligibleReason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {eligibleRows.length === 0 && (
            <div className="text-center py-10 text-sm text-text-muted">
              None of the selected orders are eligible for processing.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between shrink-0 border-t border-border-base pt-4">
          <span className="text-sm text-text-muted">
            {eligibleRows.length} eligible · {ineligibleRows.length} skipped
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-border-base px-4 py-2 text-sm font-medium text-text-strong hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="bulk-process-confirm-btn"
              onClick={handleConfirm}
              disabled={loading || !canConfirm}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <i className="fa-solid fa-spinner fa-spin text-xs" />}
              Process {eligibleRows.length} Orders
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
