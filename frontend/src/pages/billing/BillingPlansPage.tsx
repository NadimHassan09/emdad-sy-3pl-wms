import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert, Card } from '@ds';
import { BillingApi, type BillingPlanOverviewItem } from '../../api/billing';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useFilters } from '../../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../../hooks/useChunkedServerPagination';
import { useDebounced } from '../../lib/useDebounced';
import { adminMediaSrc } from '../../lib/admin-media';
import {
  formatDate,
  formatDecimal,
} from '../../lib/billing-plan-overview';

type ListFilters = {
  search: string;
  planStatus: '' | 'active' | 'inactive';
  cycleStartFrom: string;
  cycleStartTo: string;
  cycleEndFrom: string;
  cycleEndTo: string;
};

const INITIAL_FILTERS: ListFilters = {
  search: '',
  planStatus: '',
  cycleStartFrom: '',
  cycleStartTo: '',
  cycleEndFrom: '',
  cycleEndTo: '',
};

const CURRENCY = 'USD';

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

export function BillingPlansPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const { draftFilters, appliedFilters, setDraft, applyPatch } =
    useFilters<ListFilters>(INITIAL_FILTERS);
  const debouncedSearch = useDebounced(draftFilters.search, 300);

  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return;
    applyPatch({ search: debouncedSearch });
  }, [debouncedSearch, appliedFilters.search, applyPatch]);

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

  const renewMut = useMutation({
    mutationFn: (planId: string) => BillingApi.renewPlan(planId),
    onSuccess: (result) => {
      toast.success(
        result.mode === 'reactivated'
          ? 'Billing plan renewed. Access restored and a new cycle started.'
          : 'Billing cycle marked for renewal when it expires.',
      );
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.cycles });
      void qc.invalidateQueries({ queryKey: QK.billing.capacity });
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
      void qc.invalidateQueries({ queryKey: QK.billing.overdueClients });
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

  const serverFilters = useMemo(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      planStatus: appliedFilters.planStatus || undefined,
      cycleStartFrom: appliedFilters.cycleStartFrom || undefined,
      cycleStartTo: appliedFilters.cycleStartTo || undefined,
      expiryFrom: appliedFilters.cycleEndFrom || undefined,
      expiryTo: appliedFilters.cycleEndTo || undefined,
      sort_by: 'createdAt' as const,
      sort_dir: 'desc' as const,
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
      accessor: (r) => {
        const logoSrc = adminMediaSrc(r.companyLogoUrl);
        return (
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-faint">
                <i className="fa-solid fa-building text-xs" aria-hidden="true" />
              </div>
            )}
            <span className="min-w-0 truncate font-medium text-text-strong">{r.companyName}</span>
          </div>
        );
      },
    },
    {
      header: 'Remaining days',
      accessor: (r) => {
        if (r.daysRemaining == null) {
          return <span className="text-sm text-text-muted">—</span>;
        }
        if (r.daysRemaining < 0) {
          return <BillingLabel text="Expired" variant="danger" />;
        }
        if (r.daysRemaining === 0) {
          return <BillingLabel text="Last day" variant="warning" />;
        }
        const text = `${r.daysRemaining} day${r.daysRemaining === 1 ? '' : 's'}`;
        if (r.daysRemaining <= 3) {
          return <BillingLabel text={text} variant="danger" />;
        }
        if (r.daysRemaining <= 7) {
          return <BillingLabel text={text} variant="warning" />;
        }
        return <span className="text-sm text-text-body">{text}</span>;
      },
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
      header: 'Status',
      accessor: (r) =>
        r.plan.active ? (
          <BillingLabel text="Active" variant="success" />
        ) : (
          <BillingLabel text="Inactive" variant="neutral" />
        ),
    },
    {
      header: 'Auto renewal',
      accessor: (r) =>
        r.plan.autoRenew === false ? (
          <BillingLabel text="Off" variant="neutral" />
        ) : (
          <BillingLabel text="On" variant="success" />
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
            {canMutate &&
            (r.billingStatus === 'restricted' ||
              r.cycleStatus === 'active' ||
              r.cycleStatus === 'expired' ||
              r.cycleStatus === 'none') ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-status-success-fg hover:bg-status-success-bg"
                disabled={renewMut.isPending}
                onClick={() => {
                  const restricted = r.billingStatus === 'restricted' || r.cycleStatus !== 'active';
                  if (
                    !window.confirm(
                      restricted
                        ? `Renew billing plan for ${r.companyName}? This restores access and starts a new billing cycle.`
                        : `Mark billing cycle for ${r.companyName} for renewal when it expires?`,
                    )
                  ) {
                    return;
                  }
                  setOpenActionId(null);
                  renewMut.mutate(r.plan.id);
                }}
              >
                Renew
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
    <AdminListPageShell
      icon="fa-file-invoice-dollar"
      title="Billing plans"
      subtitle="Subscription storage billing by client — reserved volume, price, and cycle."
      actions={
        canMutate ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="!border-brand-600 !bg-white !text-brand-700 hover:!bg-brand-50 hover:!text-brand-800"
              onClick={() => navigate('/billing/templates')}
            >
              Create plan template
            </Button>
            <Button variant="brand" onClick={() => navigate('/billing/plans/new')}>
              + Create plan
            </Button>
          </div>
        ) : undefined
      }
    >
      <Card padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-[12rem] flex-1">
            <i
              className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
              aria-hidden
            />
            <input
              value={draftFilters.search}
              onChange={(e) => setDraft({ search: e.target.value })}
              placeholder="Search client…"
              className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken py-2 pl-9 pr-4 text-sm text-text-strong placeholder:text-text-faint"
            />
          </div>
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-semibold text-text-muted">
            Status
            <select
              value={draftFilters.planStatus}
              onChange={(e) =>
                applyPatch({ planStatus: e.target.value as ListFilters['planStatus'] })
              }
              aria-label="Status"
              className="input-premium rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm font-normal text-text-body"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="flex min-w-[9.5rem] flex-col gap-1 text-xs font-semibold text-text-muted">
            Cycle start from
            <input
              type="date"
              value={draftFilters.cycleStartFrom}
              onChange={(e) => applyPatch({ cycleStartFrom: e.target.value })}
              className="input-premium rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm font-normal text-text-body"
            />
          </label>
          <label className="flex min-w-[9.5rem] flex-col gap-1 text-xs font-semibold text-text-muted">
            Cycle start to
            <input
              type="date"
              value={draftFilters.cycleStartTo}
              onChange={(e) => applyPatch({ cycleStartTo: e.target.value })}
              className="input-premium rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm font-normal text-text-body"
            />
          </label>
          <label className="flex min-w-[9.5rem] flex-col gap-1 text-xs font-semibold text-text-muted">
            Cycle end from
            <input
              type="date"
              value={draftFilters.cycleEndFrom}
              onChange={(e) => applyPatch({ cycleEndFrom: e.target.value })}
              className="input-premium rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm font-normal text-text-body"
            />
          </label>
          <label className="flex min-w-[9.5rem] flex-col gap-1 text-xs font-semibold text-text-muted">
            Cycle end to
            <input
              type="date"
              value={draftFilters.cycleEndTo}
              onChange={(e) => applyPatch({ cycleEndTo: e.target.value })}
              className="input-premium rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm font-normal text-text-body"
            />
          </label>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.plan.id}
        onRowClick={(r) => navigate(`/billing/plans/${r.companyId}`)}
        getRowClassName={(r) =>
          r.daysRemaining != null && r.daysRemaining >= 0 && r.daysRemaining <= 3
            ? 'bg-red-50/80 dark:bg-red-950/25'
            : undefined
        }
        loading={pagination.isInitialLoading}
        empty="No billing plans match your filters."
        serverPagination={pagination.serverPagination}
      />

      {pagination.isError ? (
        <Alert variant="error" title={(pagination.error as Error).message} className="mb-4" />
      ) : null}
    </AdminListPageShell>
  );
}
