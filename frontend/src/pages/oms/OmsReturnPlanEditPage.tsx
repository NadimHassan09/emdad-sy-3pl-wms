import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Alert, Button } from '@ds';

import { OmsReturnsApi } from '../../api/oms';
import { Combobox } from '../../components/Combobox';
import { ReceivingDockPicker } from '../../components/locations/ReceivingDockPicker';
import { StorageLocationPicker } from '../../components/locations/StorageLocationPicker';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import type { InboundExecutionPlan } from '../../lib/execution-plan';
import { inboundAdminPlanReadinessIssues } from '../../lib/execution-plan';

type PutawayRow = { key: string; locationId: string; qty: string };
type DraftLine = {
  key: string;
  productId: string;
  sku: string;
  name: string;
  uom: string;
  expectedQuantity: string;
  putaway: PutawayRow[];
};

function AllocationBadge({
  allocated,
  expected,
  complete,
  label,
}: {
  allocated: number;
  expected: number;
  complete: boolean;
  label: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        complete
          ? 'bg-status-success-bg text-status-success-fg'
          : 'bg-status-warning-bg text-status-warning-fg'
      }`}
    >
      {label}: {allocated}/{expected}
    </span>
  );
}

export function OmsReturnPlanEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';

  const [receivingDockId, setReceivingDockId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const existing = useQuery({
    queryKey: ['oms-return', id],
    queryFn: () => OmsReturnsApi.get(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (!existing.data) return;
    const o = existing.data;
    setNotes(o.notes ?? '');
    const plan = o.executionPlan;
    if (plan?.warehouseId) setSelectedWarehouseId(plan.warehouseId);
    if (plan?.receivingDockId) setReceivingDockId(plan.receivingDockId);
    setLines(
      o.lines.map((l, i) => {
        const pl =
          plan?.lines.find((x) => x.orderLineId === l.id) ??
          plan?.lines.find((x) => x.productId === l.productId);
        const putaway =
          pl?.putaway?.length
            ? pl.putaway.map((p, j) => ({
                key: `${i}-${j}`,
                locationId: p.locationId,
                qty: String(p.qty),
              }))
            : [
                {
                  key: `${i}-0`,
                  locationId: '',
                  qty: String(l.quantity),
                },
              ];
        return {
          key: l.id,
          productId: l.productId,
          sku: l.product?.sku ?? '',
          name: l.product?.name ?? '',
          uom: l.product?.uom ?? '',
          expectedQuantity: String(l.quantity),
          putaway,
        };
      }),
    );
  }, [existing.data]);

  useEffect(() => {
    setSelectedWarehouseId((cur) =>
      cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId,
    );
  }, [warehouseId, warehouses]);

  const planPreview: InboundExecutionPlan | null = useMemo(() => {
    if (!effectiveWarehouseId) return null;
    return {
      warehouseId: effectiveWarehouseId,
      receivingDockId: receivingDockId.trim(),
      planUpdatedAt: new Date().toISOString(),
      lines: lines.map((l) => ({
        productId: l.productId,
        orderLineId: l.key,
        expectedQty: Number(l.expectedQuantity) || 0,
        putaway: l.putaway
          .filter((r) => r.locationId.trim() && Number(r.qty) > 0)
          .map((r) => ({ locationId: r.locationId.trim(), qty: Number(r.qty) })),
      })),
    };
  }, [effectiveWarehouseId, lines, receivingDockId]);

  const readinessIssues = useMemo(() => {
    if (!existing.data) return ['Loading…'];
    return inboundAdminPlanReadinessIssues(
      planPreview,
      existing.data.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        expectedQuantity: l.quantity,
      })),
    );
  }, [existing.data, planPreview]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!planPreview) throw new Error('Select a warehouse.');
      if (readinessIssues.length > 0) {
        throw new Error(readinessIssues[0] ?? 'Plan incomplete.');
      }
      // One putaway location per product (warehouse return posts once per line).
      for (const line of planPreview.lines) {
        const locs = [...new Set((line.putaway ?? []).map((p) => p.locationId))];
        if (locs.length > 1) {
          throw new Error(
            `Use one putaway location per product (${line.productId}).`,
          );
        }
      }
      return OmsReturnsApi.updatePlan(id, {
        executionMode: 'admin',
        executionPlan: planPreview,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Return plan saved.');
      void qc.invalidateQueries({ queryKey: ['oms-return', id] });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      navigate(`/oms/returns/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMut.mutate();
  }

  if (!id) return null;
  if (existing.isLoading) {
    return <p className="text-sm text-text-muted animate-enter">Loading return…</p>;
  }
  if (existing.isError || !existing.data) {
    return <Alert variant="error" title="Failed to load OMS return." />;
  }
  if (existing.data.status !== 'requested') {
    return (
      <div className="space-y-3 animate-enter">
        <Alert variant="warning" title="Plan is locked">
          This return is already {existing.data.status.replace(/_/g, ' ')}. Open the return
          details to continue warehouse stages.
        </Alert>
        <Link to={`/oms/returns/${id}`} className="text-sm font-medium text-brand-700 hover:underline">
          Back to return details
        </Link>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-3xl space-y-8 animate-enter pb-16" onSubmit={onSubmit}>
      <div>
        <Link
          to={`/oms/returns/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-strong"
        >
          ← Back to return
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-strong">
          Edit return plan · {existing.data.returnNumber}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Set the receiving area and putaway location for each product, then save. Approve from
          the return details page.
        </p>
      </div>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Receiving area
        </h2>
        {warehouses.length > 1 ? (
          <Combobox
            label="Warehouse"
            required
            value={selectedWarehouseId || warehouseId}
            onChange={setSelectedWarehouseId}
            options={warehouses
              .filter((w) => w.status === 'active')
              .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
            clearable={false}
            dropdownInFlow
          />
        ) : null}
        {effectiveWarehouseId ? (
          <ReceivingDockPicker
            warehouseId={effectiveWarehouseId}
            value={receivingDockId}
            onChange={setReceivingDockId}
            label="Receiving dock"
            dropdownInFlow
          />
        ) : (
          <Alert variant="warning" title="Set a default warehouse first." />
        )}
        <p className="text-sm text-text-muted">
          This is where the return shipment will arrive before putaway.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Putaway plan (where to store items)
        </h2>
        <p className="text-sm text-text-muted">
          Assign one storage location per product. Allocated quantity must equal the return
          quantity.
        </p>

        <div className="space-y-6">
          {lines.map((line) => {
            const expected = Number(line.expectedQuantity) || 0;
            const allocated = line.putaway.reduce((a, r) => {
              if (!r.locationId.trim()) return a;
              return a + (Number(r.qty) || 0);
            }, 0);
            const complete = expected > 0 && Math.abs(allocated - expected) < 1e-6;

            return (
              <div
                key={line.key}
                className="space-y-3 border-b border-border-subtle pb-6 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-text-strong">
                      {line.sku ? `${line.sku} — ${line.name}` : line.name || '—'}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      Return qty:{' '}
                      <span className="font-mono font-semibold text-text-strong">
                        {line.expectedQuantity || '—'}
                      </span>
                      {line.uom ? (
                        <span className="ms-1 uppercase text-text-body">{line.uom}</span>
                      ) : null}
                    </div>
                  </div>
                  <AllocationBadge
                    allocated={allocated}
                    expected={expected}
                    complete={complete}
                    label="Allocated"
                  />
                </div>

                <div className="space-y-2.5">
                  {line.putaway.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px]"
                    >
                      {effectiveWarehouseId ? (
                        <StorageLocationPicker
                          warehouseId={effectiveWarehouseId}
                          value={row.locationId}
                          onChange={(locId) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key !== line.key
                                  ? l
                                  : {
                                      ...l,
                                      putaway: l.putaway.map((r) =>
                                        r.key !== row.key
                                          ? r
                                          : { ...r, locationId: locId },
                                      ),
                                    },
                              ),
                            )
                          }
                          label="Putaway location"
                          dropdownInFlow
                        />
                      ) : null}
                      <TextField
                        label="Qty"
                        type="number"
                        inputMode="decimal"
                        value={row.qty}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key !== line.key
                                ? l
                                : {
                                    ...l,
                                    putaway: l.putaway.map((r) =>
                                      r.key !== row.key ? r : { ...r, qty: e.target.value },
                                    ),
                                  },
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Notes</h2>
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {readinessIssues.length > 0 ? (
        <Alert variant="warning" title="Plan incomplete">
          <ul className="mt-1 list-inside list-disc text-sm">
            {readinessIssues.slice(0, 5).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={saveMut.isPending}>
          Save plan
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(`/oms/returns/${id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
