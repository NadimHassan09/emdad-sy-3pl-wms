import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  BillingApi,
  type BillingPlanOverviewItem,
  type CreateBillingPlanPayload,
  type UpdateBillingPlanPayload,
} from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { BillingPlanFormModal } from '../../components/billing/BillingPlanFormModal';
import { VolumeAllocationPanel } from '../../components/billing/VolumeAllocationPanel';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useFilters } from '../../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../../hooks/useChunkedServerPagination';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import {
  formatDate,
  formatDecimal,
  type BillingStatusDisplay,
  type BillingStatusFilter,
  type BillingCycleStatusDisplay,
  type CycleStatusFilter,
  type DaysRemainingFilter,
} from '../../lib/billing-plan-overview';

type ListFilters = {
  companyId: string;
  search: string;
  cycleStatus: CycleStatusFilter;
  daysRemaining: DaysRemainingFilter;
  billingStatus: BillingStatusFilter;
  expiryFrom: string;
  expiryTo: string;
  sort_by: 'companyName' | 'cycleEnd' | 'daysRemaining' | 'createdAt';
  sort_dir: 'asc' | 'desc';
};

const INITIAL_FILTERS: ListFilters = {
  companyId: '',
  search: '',
  cycleStatus: '',
  daysRemaining: '',
  billingStatus: '',
  expiryFrom: '',
  expiryTo: '',
  sort_by: 'createdAt',
  sort_dir: 'desc',
};

function BillingLabel({
  text,
  variant,
}: {
  text: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const cls = {
    success: 'badge-complete',
    warning: 'badge-progress',
    danger: 'badge-cancelled',
    neutral: 'badge-draft',
  }[variant];
  return <span className={`badge w-fit ${cls}`}>{text}</span>;
}

function cycleStatusBadge(status: BillingCycleStatusDisplay) {
  const map = {
    active: { label: 'Active', variant: 'success' as const },
    renewed: { label: 'Renewed', variant: 'warning' as const },
    expired: { label: 'Expired', variant: 'warning' as const },
    none: { label: 'No cycle', variant: 'neutral' as const },
  };
  const m = map[status];
  return <BillingLabel text={m.label} variant={m.variant} />;
}

function billingStatusBadge(status: BillingStatusDisplay) {
  const map = {
    operational: { label: 'Operational', variant: 'success' as const },
    restricted: { label: 'Restricted', variant: 'danger' as const },
    inactive: { label: 'Inactive', variant: 'neutral' as const },
  };
  const m = map[status];
  return <BillingLabel text={m.label} variant={m.variant} />;
}

function daysRemainingLabel(n: number | null): string {
  if (n == null) return '—';
  if (n <= 0) return 'Expired';
  return `${n}d`;
}

export function BillingPlansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS);

  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<BillingPlanOverviewItem | null>(null);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-billing-action-trigger="true"]') ||
        target.closest('[data-billing-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const capacityQuery = useQuery({
    queryKey: QK.billing.capacity,
    queryFn: () => BillingApi.getCapacitySummary(),
    enabled: canMutate,
  });

  const serverFilters = useMemo(
    () => ({
      companyId: appliedFilters.companyId.trim() || undefined,
      search: appliedFilters.search.trim() || undefined,
      cycleStatus: appliedFilters.cycleStatus || undefined,
      daysRemaining: appliedFilters.daysRemaining || undefined,
      billingStatus: appliedFilters.billingStatus || undefined,
      expiryFrom: appliedFilters.expiryFrom || undefined,
      expiryTo: appliedFilters.expiryTo || undefined,
      sort_by: appliedFilters.sort_by,
      sort_dir: appliedFilters.sort_dir,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<BillingPlanOverviewItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: serverFilters,
    fetchChunk: (offset, limit) =>
      BillingApi.listPlansPage({ ...serverFilters, offset, limit }),
    rtQueryKeyPrefix: QK.billing.plans,
    chunkQueryKeyPrefix: 'billing-plans-chunk',
  });

  const invalidateBilling = () => {
    void qc.invalidateQueries({ queryKey: QK.billing.plans });
    void qc.invalidateQueries({ queryKey: QK.billing.cycles });
    void qc.invalidateQueries({ queryKey: QK.billing.capacity });
    void qc.invalidateQueries({ queryKey: QK.billing.expiringSoon });
  };

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanPayload) => BillingApi.createPlan(payload),
    onSuccess: () => {
      toast.success('Billing plan created.');
      setCreateOpen(false);
      invalidateBilling();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBillingPlanPayload }) =>
      BillingApi.updatePlan(id, payload),
    onSuccess: () => {
      toast.success('Billing plan updated.');
      setEditRow(null);
      setOpenActionId(null);
      invalidateBilling();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renewMut = useMutation({
    mutationFn: (cycleId: string) => BillingApi.renewCycle(cycleId),
    onSuccess: () => {
      toast.success('Billing cycle marked for renewal.');
      setOpenActionId(null);
      invalidateBilling();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<BillingPlanOverviewItem>[] = [
    {
      header: 'Client',
      accessor: (r) => <span className="font-medium text-slate-900">{r.companyName}</span>,
    },
    { header: 'Cycle start', accessor: (r) => formatDate(r.cycleStart) },
    { header: 'Cycle end', accessor: (r) => formatDate(r.cycleEnd) },
    {
      header: 'Days remaining',
      accessor: (r) => (
        <span className={r.daysRemaining != null && r.daysRemaining <= 7 ? 'font-medium text-amber-700' : ''}>
          {daysRemainingLabel(r.daysRemaining)}
        </span>
      ),
    },
    { header: 'Cycle length', accessor: (r) => `${r.plan.cycleLengthDays}d` },
    {
      header: 'Fixed fee',
      accessor: (r) => formatDecimal(r.plan.fixedSubscriptionFee),
    },
    {
      header: 'Reserved volume',
      accessor: (r) => `${formatDecimal(r.plan.reservedVolume, 4)} CBM`,
    },
    {
      header: 'Reserved weight',
      accessor: (r) => `${formatDecimal(r.plan.reservedWeight, 4)} kg`,
    },
    {
      header: 'Status',
      accessor: (r) => (
        <div className="flex flex-col gap-1">
          {cycleStatusBadge(r.cycleStatus)}
          {billingStatusBadge(r.billingStatus)}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="relative" data-billing-action-trigger="true" onClick={(e) => e.stopPropagation()}>
          <AnchoredDropdown
            open={openActionId === r.plan.id}
            align="end"
            menuRootProps={{ 'data-billing-action-menu': 'true' }}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                data-billing-action-menu-button="true"
                onClick={() => setOpenActionId((cur) => (cur === r.plan.id ? null : r.plan.id))}
                aria-label="Open actions"
                aria-expanded={openActionId === r.plan.id}
                aria-haspopup="menu"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                </svg>
              </button>
            }
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setOpenActionId(null);
                navigate(`/billing/plans/${r.companyId}`);
              }}
            >
              View
            </button>
            {canMutate ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpenActionId(null);
                  setEditRow(r);
                }}
              >
                Edit
              </button>
            ) : null}
            {canMutate && r.currentCycle && r.currentCycle.status === 'active' ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  if (!window.confirm('Mark this billing cycle for renewal when it expires?')) return;
                  renewMut.mutate(r.currentCycle!.id);
                }}
              >
                Renew
              </button>
            ) : null}
          </AnchoredDropdown>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <VolumeAllocationPanel
        capacity={capacityQuery.data}
        loading={capacityQuery.isLoading}
      />

      <FilterPanel
        title="Billing plan filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel="Apply filters"
        resetLabel="Reset filters"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <TextField
            label="Search client"
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder="Client name"
          />
          <Combobox
            label="Client"
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={companyFilterComboboxOptions(companiesQuery.data, 'All clients')}
            placeholder="All clients"
          />
          <SelectField
            label="Cycle status"
            value={draftFilters.cycleStatus}
            onChange={(e) => setDraft({ cycleStatus: e.target.value as CycleStatusFilter })}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'renewed', label: 'Renewed' },
              { value: 'expired', label: 'Expired' },
              { value: 'none', label: 'No cycle' },
            ]}
          />
          <SelectField
            label="Days remaining"
            value={draftFilters.daysRemaining}
            onChange={(e) => {
              const v = e.target.value as unknown as DaysRemainingFilter;
              setDraft({ daysRemaining: v });
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'critical', label: '≤ 7 days' },
              { value: 'warning', label: '8–30 days' },
              { value: 'healthy', label: '> 30 days' },
              { value: 'expired', label: 'Expired' },
              { value: 'none', label: 'No cycle' },
            ]}
          />
          <SelectField
            label="Billing status"
            value={draftFilters.billingStatus}
            onChange={(e) => {
              const v = e.target.value as unknown as BillingStatusFilter;
              setDraft({ billingStatus: v });
            }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'operational', label: 'Operational' },
              { value: 'restricted', label: 'Restricted' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <TextField
            label="Expiry from"
            type="date"
            value={draftFilters.expiryFrom}
            onChange={(e) => setDraft({ expiryFrom: e.target.value })}
          />
          <TextField
            label="Expiry to"
            type="date"
            value={draftFilters.expiryTo}
            onChange={(e) => setDraft({ expiryTo: e.target.value })}
          />
          <SelectField
            label="Sort by"
            value={draftFilters.sort_by}
            onChange={(e) =>
              setDraft({
                sort_by: e.target.value as ListFilters['sort_by'],
              })
            }
            options={[
              { value: 'createdAt', label: 'Created' },
              { value: 'companyName', label: 'Client name' },
              { value: 'cycleEnd', label: 'Cycle end' },
              { value: 'daysRemaining', label: 'Days remaining' },
            ]}
          />
          <SelectField
            label="Sort direction"
            value={draftFilters.sort_dir}
            onChange={(e) =>
              setDraft({ sort_dir: e.target.value as 'asc' | 'desc' })
            }
            options={[
              { value: 'desc', label: 'Descending' },
              { value: 'asc', label: 'Ascending' },
            ]}
          />
        </div>
      </FilterPanel>

      <DataTable
        title="Billing plans"
        description="Click a row to open client billing plan details."
        actions={
          canMutate ? (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              + Create plan
            </Button>
          ) : undefined
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.plan.id}
        onRowClick={(r) => navigate(`/billing/plans/${r.companyId}`)}
        loading={pagination.isInitialLoading}
        empty="No billing plans match your filters."
        serverPagination={pagination.serverPagination}
      />

      {pagination.isError ? (
        <p className="text-sm text-rose-600">{(pagination.error as Error).message}</p>
      ) : null}

      <BillingPlanFormModal
        open={createOpen}
        mode="create"
        companies={companiesQuery.data ?? []}
        saving={createMut.isPending}
        onClose={() => !createMut.isPending && setCreateOpen(false)}
        onSubmit={(payload) => createMut.mutate(payload as CreateBillingPlanPayload)}
      />

      <BillingPlanFormModal
        open={!!editRow}
        mode="edit"
        companies={companiesQuery.data ?? []}
        plan={editRow?.plan ?? null}
        saving={updateMut.isPending}
        onClose={() => !updateMut.isPending && setEditRow(null)}
        onSubmit={(payload) => {
          if (!editRow) return;
          updateMut.mutate({ id: editRow.plan.id, payload: payload as UpdateBillingPlanPayload });
        }}
      />
    </div>
  );
}
