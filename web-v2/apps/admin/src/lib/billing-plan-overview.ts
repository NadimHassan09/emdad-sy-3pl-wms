import type { BillingCycleRow, BillingPlanRow } from '../api/billing';

const MS_PER_DAY = 86_400_000;

export type CycleStatusFilter = '' | 'active' | 'renewed' | 'expired' | 'none';
export type DaysRemainingFilter = '' | 'critical' | 'warning' | 'healthy' | 'expired' | 'none';
export type BillingStatusFilter = '' | 'operational' | 'restricted' | 'inactive';

export type BillingPlanOverviewRow = {
  plan: BillingPlanRow;
  companyId: string;
  companyName: string;
  companyStatus: string;
  currentCycle: BillingCycleRow | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  daysRemaining: number | null;
  cycleStatus: BillingCycleStatusDisplay;
  billingStatus: BillingStatusDisplay;
};

export type BillingCycleStatusDisplay = 'active' | 'renewed' | 'expired' | 'none';
export type BillingStatusDisplay = 'operational' | 'restricted' | 'inactive';

export function daysRemainingFromEnd(endsAt: string | Date, asOf = new Date()): number {
  const end = typeof endsAt === 'string' ? new Date(endsAt) : endsAt;
  return Math.ceil((end.getTime() - asOf.getTime()) / MS_PER_DAY);
}

export function pickCurrentCycle(cycles: BillingCycleRow[], asOf = new Date()): BillingCycleRow | null {
  const current = cycles.filter(
    (c) =>
      (c.status === 'active' || c.status === 'renewed') &&
      new Date(c.startsAt) <= asOf &&
      new Date(c.endsAt) > asOf,
  );
  if (!current.length) return null;
  return current.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  )[0]!;
}

export function deriveBillingStatus(
  plan: BillingPlanRow,
  companyStatus: string,
  currentCycle: BillingCycleRow | null,
): BillingStatusDisplay {
  if (companyStatus === 'restricted') return 'restricted';
  if (!plan.active) return 'inactive';
  if (!currentCycle) return 'inactive';
  return 'operational';
}

export function deriveCycleStatusDisplay(
  currentCycle: BillingCycleRow | null,
  asOf = new Date(),
): BillingCycleStatusDisplay {
  if (!currentCycle) return 'none';
  if (new Date(currentCycle.endsAt) <= asOf) return 'expired';
  return currentCycle.status === 'renewed' ? 'renewed' : 'active';
}

export function buildBillingPlanOverviewRows(args: {
  plans: BillingPlanRow[];
  cycles: BillingCycleRow[];
  companyNameById: Map<string, string>;
  companyStatusById: Map<string, string>;
}): BillingPlanOverviewRow[] {
  const cyclesByCompany = new Map<string, BillingCycleRow[]>();
  for (const cycle of args.cycles) {
    const list = cyclesByCompany.get(cycle.companyId) ?? [];
    list.push(cycle);
    cyclesByCompany.set(cycle.companyId, list);
  }

  return args.plans.map((plan) => {
    const companyCycles = cyclesByCompany.get(plan.companyId) ?? [];
    const currentCycle = pickCurrentCycle(companyCycles);
    const companyStatus = args.companyStatusById.get(plan.companyId) ?? 'active';
    const cycleStatus = deriveCycleStatusDisplay(currentCycle);
    const billingStatus = deriveBillingStatus(plan, companyStatus, currentCycle);
    const daysRemaining =
      currentCycle && cycleStatus !== 'expired'
        ? daysRemainingFromEnd(currentCycle.endsAt)
        : currentCycle
          ? daysRemainingFromEnd(currentCycle.endsAt)
          : null;

    return {
      plan,
      companyId: plan.companyId,
      companyName: args.companyNameById.get(plan.companyId) ?? plan.companyId,
      companyStatus,
      currentCycle,
      cycleStart: currentCycle?.startsAt ?? null,
      cycleEnd: currentCycle?.endsAt ?? null,
      daysRemaining,
      cycleStatus,
      billingStatus,
    };
  });
}

export function filterOverviewRows(
  rows: BillingPlanOverviewRow[],
  filters: {
    companyId: string;
    cycleStatus: CycleStatusFilter;
    daysRemaining: DaysRemainingFilter;
    billingStatus: BillingStatusFilter;
  },
): BillingPlanOverviewRow[] {
  return rows.filter((row) => {
    if (filters.companyId && row.companyId !== filters.companyId) return false;

    if (filters.cycleStatus && row.cycleStatus !== filters.cycleStatus) return false;

    if (filters.billingStatus && row.billingStatus !== filters.billingStatus) return false;

    if (filters.daysRemaining) {
      if (filters.daysRemaining === 'none') {
        if (row.currentCycle) return false;
      } else if (row.daysRemaining == null) {
        return false;
      } else if (filters.daysRemaining === 'expired') {
        if (row.daysRemaining > 0) return false;
      } else if (filters.daysRemaining === 'critical') {
        if (row.daysRemaining < 0 || row.daysRemaining > 7) return false;
      } else if (filters.daysRemaining === 'warning') {
        if (row.daysRemaining <= 7 || row.daysRemaining > 30) return false;
      } else if (filters.daysRemaining === 'healthy') {
        if (row.daysRemaining <= 30) return false;
      }
    }

    return true;
  });
}

export function formatDecimal(value: string | number, digits = 2): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function warehouseAllocationPercent(
  allocated: string,
  total: string,
): string {
  const a = Number(allocated);
  const t = Number(total);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return '—';
  return `${((a / t) * 100).toFixed(1)}%`;
}
