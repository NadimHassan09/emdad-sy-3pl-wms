import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

import {
  BillingApi,
  type CreateBillingPlanPayload,
  type UpdateBillingPlanPayload,
} from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { BillingInvoicePreviewCard } from '../../components/billing/BillingInvoicePreviewCard';
import { BillingPlanFormModal } from '../../components/billing/BillingPlanFormModal';
import { VolumeAllocationPanel } from '../../components/billing/VolumeAllocationPanel';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import {
  daysRemainingFromEnd,
  formatDate,
  formatDecimal,
  pickCurrentCycle,
} from '../../lib/billing-plan-overview';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function BillingPlanDetailPage() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const companyQuery = useQuery({
    queryKey: [...QK.companies, clientId],
    queryFn: () => CompaniesApi.get(clientId),
    enabled: !!clientId,
  });

  const plansQuery = useQuery({
    queryKey: [...QK.billing.plans, clientId],
    queryFn: () => BillingApi.listPlans(clientId),
    enabled: !!clientId,
  });

  const cyclesQuery = useQuery({
    queryKey: [...QK.billing.cycles, clientId],
    queryFn: () => BillingApi.listCycles(clientId),
    enabled: !!clientId,
  });

  const capacityQuery = useQuery({
    queryKey: QK.billing.capacity,
    queryFn: () => BillingApi.getCapacitySummary(),
    enabled: canMutate,
  });

  const activePlan = useMemo(
    () => (plansQuery.data ?? []).find((p) => p.active) ?? plansQuery.data?.[0] ?? null,
    [plansQuery.data],
  );

  const currentCycle = useMemo(
    () => pickCurrentCycle(cyclesQuery.data ?? []),
    [cyclesQuery.data],
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK.billing.plans });
    void qc.invalidateQueries({ queryKey: [...QK.billing.plans, clientId] });
    void qc.invalidateQueries({ queryKey: QK.billing.cycles });
    void qc.invalidateQueries({ queryKey: [...QK.billing.cycles, clientId] });
    void qc.invalidateQueries({ queryKey: QK.billing.capacity });
  };

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanPayload) => BillingApi.createPlan(payload),
    onSuccess: () => {
      toast.success('Billing plan created.');
      setCreateOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: (payload: UpdateBillingPlanPayload) => {
      if (!activePlan) throw new Error('No plan');
      return BillingApi.updatePlan(activePlan.id, payload);
    },
    onSuccess: () => {
      toast.success('Billing plan updated.');
      setEditOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renewMut = useMutation({
    mutationFn: () => {
      if (!currentCycle) throw new Error('No active cycle');
      return BillingApi.renewCycle(currentCycle.id);
    },
    onSuccess: () => {
      toast.success('Billing cycle marked for renewal.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const company = companyQuery.data;
  const daysLeft = currentCycle ? daysRemainingFromEnd(currentCycle.endsAt) : null;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/billing/plans" className="hover:underline">
          ← Back to billing plans
        </Link>
      </div>

      <PageHeader
        title={company ? `${company.name} — billing plan` : 'Client billing plan'}
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              {!activePlan ? (
                <Button variant="brand" onClick={() => setCreateOpen(true)}>
                  Create plan
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    Edit plan
                  </Button>
                  {currentCycle?.status === 'active' ? (
                    <Button
                      variant="secondary"
                      disabled={renewMut.isPending}
                      onClick={() => {
                        if (!window.confirm('Mark this billing cycle for renewal when it expires?')) return;
                        renewMut.mutate();
                      }}
                    >
                      Renew plan
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {companyQuery.isPending || plansQuery.isPending ? (
        <p className="text-sm text-slate-500">Loading billing details…</p>
      ) : null}

      {companyQuery.isError ? (
        <p className="text-sm text-rose-600">Could not load client details.</p>
      ) : null}

      {!activePlan && !plansQuery.isPending ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">This client has no billing plan yet.</p>
          {canMutate ? (
            <Button className="mt-3" variant="brand" onClick={() => setCreateOpen(true)}>
              Create billing plan
            </Button>
          ) : null}
        </div>
      ) : null}

      {activePlan ? (
        <>
          <VolumeAllocationPanel
            capacity={capacityQuery.data}
            reservedVolume={activePlan.reservedVolume}
            reservedWeight={activePlan.reservedWeight}
            loading={capacityQuery.isLoading}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Billing plan</h3>
              <StatusBadge status={activePlan.active ? 'active' : 'paused'} />
              {company?.status === 'restricted' ? (
                <span className="badge badge-cancelled w-fit">restricted</span>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Cycle length" value={`${activePlan.cycleLengthDays} days`} />
              <DetailField label="Fixed subscription fee" value={formatDecimal(activePlan.fixedSubscriptionFee)} />
              <DetailField label="Inbound order fee" value={formatDecimal(activePlan.inboundOrderFee, 4)} />
              <DetailField label="Outbound order fee" value={formatDecimal(activePlan.outboundOrderFee, 4)} />
              <DetailField label="Packaging fee" value={formatDecimal(activePlan.packagingFee, 4)} />
              <DetailField label="Quality check fee" value={formatDecimal(activePlan.qualityCheckFee, 4)} />
              <DetailField
                label="Excess volume fee / day"
                value={formatDecimal(activePlan.excessVolumeFeePerDay, 4)}
              />
              <DetailField
                label="Excess weight fee / day"
                value={formatDecimal(activePlan.excessWeightFeePerDay, 4)}
              />
              <DetailField
                label="Reserved volume"
                value={`${formatDecimal(activePlan.reservedVolume, 4)} CBM`}
              />
              <DetailField
                label="Reserved weight"
                value={`${formatDecimal(activePlan.reservedWeight, 4)} kg`}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Current billing cycle</h3>
            {currentCycle ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="Start" value={formatDate(currentCycle.startsAt)} />
                <DetailField label="End" value={formatDate(currentCycle.endsAt)} />
                <DetailField
                  label="Days remaining"
                  value={daysLeft != null && daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? 'Last day' : 'Expired'}
                />
                <DetailField label="Cycle status" value={currentCycle.status} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No active billing cycle for this client.</p>
            )}
          </section>

          {activePlan ? <BillingInvoicePreviewCard companyId={clientId} /> : null}
        </>
      ) : null}

      <BillingPlanFormModal
        open={createOpen}
        mode="create"
        companies={company ? [{ id: company.id, name: company.name }] : []}
        initialCompanyId={clientId}
        saving={createMut.isPending}
        onClose={() => !createMut.isPending && setCreateOpen(false)}
        onSubmit={(payload) => createMut.mutate({ ...(payload as CreateBillingPlanPayload), companyId: clientId })}
      />

      <BillingPlanFormModal
        open={editOpen}
        mode="edit"
        companies={company ? [{ id: company.id, name: company.name }] : []}
        plan={activePlan}
        saving={updateMut.isPending}
        onClose={() => !updateMut.isPending && setEditOpen(false)}
        onSubmit={(payload) => updateMut.mutate(payload as UpdateBillingPlanPayload)}
      />
    </div>
  );
}
