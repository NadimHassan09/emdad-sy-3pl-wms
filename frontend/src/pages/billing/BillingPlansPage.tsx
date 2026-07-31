import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, ListPageHeader } from '@ds';
import { BillingApi, type BillingPlanOverviewItem } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
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
  planType: '' | 'custom' | 'template';
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
  planType: '',
  expiryFrom: '',
  expiryTo: '',
  sort_by: 'createdAt',
  sort_dir: 'desc',
};

const CURRENCY = 'SYP';

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

export function BillingPlansPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS);

  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const suspendMut = useMutation({
    mutationFn: (planId: string) => BillingApi.suspendPlan(planId),
    onSuccess: () => {
      toast.success('Billing plan suspended. Subscription is frozen.');
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.capacity });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resumeMut = useMutation({
    mutationFn: (planId: string) => BillingApi.resumePlan(planId),
    onSuccess: () => {
      toast.success('Billing plan resumed. Subscription is active again.');
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.capacity });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      // Menu is portaled to document.body — must include menu root, not only the trigger.
      if (
        target.closest('[data-billing-action-trigger="true"]') ||
        target.closest('[data-billing-action-menu="true"]') ||
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
      planType: appliedFilters.planType || undefined,
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

  const columns: Column<BillingPlanOverviewItem>[] = [
    {
      header: 'Client',
      accessor: (r) => <span className="font-medium text-text-strong">{r.companyName}</span>,
    },
    {
      header: 'Plan type',
      accessor: (r) =>
        r.plan.planType === 'template' ? (
          <span className="text-sm text-text-body">
            Template
            {r.plan.templateName ? (
              <span className="block text-xs text-text-muted">{r.plan.templateName}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-text-body">Custom</span>
        ),
    },
    {
      header: 'Reserved volume',
      accessor: (r) => `${formatDecimal(r.plan.reservedVolume, 2)} m³`,
    },
    {
      header: 'Price',
      accessor: (r) => `${formatDecimal(r.plan.fixedSubscriptionFee)} ${CURRENCY}`,
    },
    {
      header: 'Billing cycle',
      accessor: (r) => `${r.plan.cycleLengthDays} days`,
    },
    {
      header: 'Current cycle start',
      accessor: (r) => formatDate(r.cycleStart),
    },
    {
      header: 'Current cycle end',
      accessor: (r) => formatDate(r.cycleEnd),
    },
    {
      header: 'Next renewal',
      accessor: (r) => formatDate(r.nextRenewalDate ?? r.cycleEnd),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <div className="flex flex-col gap-1">
          {cycleStatusBadge(r.cycleStatus)}
          {billingStatusBadge(r.billingStatus)}
          {r.plan.pendingChanges ? (
            <BillingLabel text="Pending changes" variant="warning" />
          ) : null}
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-body transition hover:bg-surface-card-muted"
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
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
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
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                onClick={() => {
                  setOpenActionId(null);
                  navigate(`/billing/plans/${r.companyId}/edit`);
                }}
              >
                Edit
              </button>
            ) : null}
            {canMutate && r.plan.active ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-status-error-fg hover:bg-status-error-bg"
                disabled={suspendMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Suspend billing plan for ${r.companyName}? This freezes the subscription and stops auto-renewal.`,
                    )
                  ) {
                    return;
                  }
                  setOpenActionId(null);
                  suspendMut.mutate(r.plan.id);
                }}
              >
                Suspend
              </button>
            ) : null}
            {canMutate && !r.plan.active ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-status-success-fg hover:bg-status-success-bg"
                disabled={resumeMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Resume billing plan for ${r.companyName}? This reactivates the subscription and starts a new billing cycle if needed.`,
                    )
                  ) {
                    return;
                  }
                  setOpenActionId(null);
                  resumeMut.mutate(r.plan.id);
                }}
              >
                Resume
              </button>
            ) : null}
          </AnchoredDropdown>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ListPageHeader
        icon="fa-file-invoice-dollar"
        title="Billing plans"
        subtitle="Subscription storage billing by client — reserved volume, price, and cycle."
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate('/billing/templates')}>
                Create plan template
              </Button>
              <Button variant="brand" onClick={() => navigate('/billing/plans/new')}>
                + Create plan
              </Button>
            </div>
          ) : undefined
        }
      />

      <VolumeAllocationPanel
        capacity={capacityQuery.data}
        loading={capacityQuery.isLoading}
        title="System storage"
        description="Used storage across all clients from inventory quantity × product CBM. Reserved storage is the sum of active billing plan reserved volumes."
      />

      <FilterPanel
        title="Billing plan filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel="Apply filters"
        resetLabel="Reset filters"
      >
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
          label="Plan type"
          value={draftFilters.planType}
          onChange={(e) => setDraft({ planType: e.target.value as ListFilters['planType'] })}
          options={[
            { value: '', label: 'All types' },
            { value: 'custom', label: 'Custom' },
            { value: 'template', label: 'Template' },
          ]}
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
          onChange={(e) => setDraft({ daysRemaining: e.target.value as DaysRemainingFilter })}
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
          onChange={(e) => setDraft({ billingStatus: e.target.value as BillingStatusFilter })}
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
          onChange={(e) => setDraft({ sort_by: e.target.value as ListFilters['sort_by'] })}
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
          onChange={(e) => setDraft({ sort_dir: e.target.value as 'asc' | 'desc' })}
          options={[
            { value: 'desc', label: 'Descending' },
            { value: 'asc', label: 'Ascending' },
          ]}
        />
      </FilterPanel>

      <DataTable
        title="Active plans"
        description="Click a row to open client billing plan details. Cycles renew automatically."
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.plan.id}
        onRowClick={(r) => navigate(`/billing/plans/${r.companyId}`)}
        loading={pagination.isInitialLoading}
        empty="No billing plans match your filters."
        serverPagination={pagination.serverPagination}
      />

      {pagination.isError ? (
        <Alert variant="error" title={(pagination.error as Error).message} className="mb-4" />
      ) : null}
    </div>
  );
}
