import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  CycleCountApi,
  type CycleCountListItem,
  type CycleCountProductHistoryRow,
  type CycleCountStatus,
} from '../../api/cycle-count';
import { WorkersApi } from '../../api/workers';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import { useTenantCompanyId } from '../../hooks/useTenantCompanyId';
import { useFilters } from '../../hooks/useFilters';
import { canExecuteCycleCount, isOperatorRole } from '../../lib/rbac';

type Tab = 'sessions' | 'schedule';

type FilterDraft = {
  status: string;
  assignedWorkerId: string;
  overdueOnly: string;
  discrepancyOnly: string;
  dateFrom: string;
  dateTo: string;
};

function isOverdue(nextDueAt: string | null | undefined): boolean {
  if (!nextDueAt) return false;
  return new Date(nextDueAt).getTime() < Date.now();
}

function hasDiscrepancy(count: CycleCountListItem): boolean {
  return count.status === 'pending_review';
}

export function CycleCountListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOperator = isOperatorRole(user?.role);
  const canExecute = canExecuteCycleCount(user);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const { warehouseId: wid } = useDefaultWarehouseId();
  const companyId = useTenantCompanyId();
  const [tab, setTab] = useState<Tab>('sessions');

  const initial = useMemo<FilterDraft>(
    () => ({
      status: '',
      assignedWorkerId: '',
      overdueOnly: '',
      discrepancyOnly: '',
      dateFrom: '',
      dateTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initial);

  const listParams = useMemo(
    () => ({
      companyId: companyId || undefined,
      warehouseId: wid || undefined,
      status: (appliedFilters.status as CycleCountStatus) || undefined,
      limit: 200,
    }),
    [appliedFilters.status, companyId, wid],
  );

  const countsQuery = useQuery({
    queryKey: QK.cycleCount.list(listParams),
    queryFn: () => CycleCountApi.listCounts(listParams),
    enabled: !!wid && !!companyId && tab === 'sessions',
  });

  const scheduleQuery = useQuery({
    queryKey: QK.cycleCount.schedules(companyId || wid),
    queryFn: () => CycleCountApi.listSchedules(companyId || undefined),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });

  const historyQuery = useQuery({
    queryKey: QK.cycleCount.productHistory(wid ?? '', { ...appliedFilters, companyId }),
    queryFn: () =>
      CycleCountApi.listProductHistory({
        companyId: companyId || undefined,
        warehouseId: wid!,
        limit: 500,
      }),
    enabled: !!wid && !!companyId && tab === 'schedule',
  });

  const workersQuery = useQuery({
    queryKey: [...QK.workers.all, wid],
    queryFn: () => WorkersApi.list(wid || undefined),
    enabled: !!wid,
    staleTime: 5 * 60_000,
  });

  const intervalByWh = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scheduleQuery.data ?? []) {
      m.set(s.warehouseId, s.intervalDays);
    }
    return m;
  }, [scheduleQuery.data]);

  const filteredCounts = useMemo(() => {
    let rows = countsQuery.data ?? [];
    if (appliedFilters.assignedWorkerId) {
      rows = rows.filter((r) => r.assignedWorker?.id === appliedFilters.assignedWorkerId);
    }
    if (appliedFilters.discrepancyOnly === 'yes') {
      rows = rows.filter(hasDiscrepancy);
    }
    if (appliedFilters.dateFrom) {
      const from = new Date(`${appliedFilters.dateFrom}T00:00:00`).getTime();
      rows = rows.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (appliedFilters.dateTo) {
      const to = new Date(`${appliedFilters.dateTo}T23:59:59.999`).getTime();
      rows = rows.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return rows;
  }, [countsQuery.data, appliedFilters]);

  const filteredHistory = useMemo(() => {
    let rows = historyQuery.data ?? [];
    if (appliedFilters.overdueOnly === 'yes') {
      rows = rows.filter((r) => isOverdue(r.nextDueAt));
    }
    if (appliedFilters.dateFrom) {
      const from = new Date(`${appliedFilters.dateFrom}T00:00:00`).getTime();
      rows = rows.filter((r) => new Date(r.lastCountedAt).getTime() >= from);
    }
    if (appliedFilters.dateTo) {
      const to = new Date(`${appliedFilters.dateTo}T23:59:59.999`).getTime();
      rows = rows.filter((r) => new Date(r.lastCountedAt).getTime() <= to);
    }
    return rows;
  }, [historyQuery.data, appliedFilters]);

  const sessionCols: Column<CycleCountListItem>[] = [
    {
      header: t('Warehouse', 'المستودع'),
      accessor: (r) => (
        <span className="font-medium">{r.warehouse?.code ?? r.warehouse?.name ?? '—'}</span>
      ),
      width: '120px',
    },
    {
      header: t('Status', 'الحالة'),
      accessor: (r) => <StatusBadge status={r.status} />,
      width: '130px',
    },
    {
      header: t('Lines', 'البنود'),
      accessor: (r) => <span className="font-mono text-xs">{r._count?.lines ?? 0}</span>,
      width: '64px',
      className: 'text-right',
    },
    {
      header: t('Discrepancy', 'فرق'),
      accessor: (r) =>
        hasDiscrepancy(r) ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
            {t('Review', 'مراجعة')}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      width: '88px',
    },
    {
      header: t('Assigned', 'المكلف'),
      accessor: (r) => r.assignedWorker?.displayName ?? '—',
      width: '140px',
    },
    {
      header: t('Interval', 'الفترة'),
      accessor: (r) => {
        const d = r.schedule?.intervalDays ?? intervalByWh.get(r.warehouseId);
        return d ? `${d}d` : '—';
      },
      width: '72px',
    },
    {
      header: t('Created', 'تاريخ الإنشاء'),
      accessor: (r) => new Date(r.createdAt).toLocaleDateString(),
      width: '110px',
    },
    {
      header: t('Source', 'المصدر'),
      accessor: (r) => <span className="text-xs capitalize">{r.source}</span>,
      width: '88px',
    },
  ];

  const scheduleCols: Column<CycleCountProductHistoryRow>[] = [
    {
      header: t('Product', 'المنتج'),
      accessor: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.product.name}</div>
          <div className="font-mono text-[11px] text-slate-500">{r.product.sku}</div>
        </div>
      ),
      width: '200px',
    },
    {
      header: t('Last count', 'آخر جرد'),
      accessor: (r) => new Date(r.lastCountedAt).toLocaleDateString(),
      width: '110px',
    },
    {
      header: t('Next due', 'الاستحقاق'),
      accessor: (r) => {
        if (!r.nextDueAt) return '—';
        const overdue = isOverdue(r.nextDueAt);
        return (
          <span className={overdue ? 'font-semibold text-red-700' : ''}>
            {new Date(r.nextDueAt).toLocaleDateString()}
            {overdue ? ` (${t('overdue', 'متأخر')})` : ''}
          </span>
        );
      },
      width: '140px',
    },
    {
      header: t('Status', 'الحالة'),
      accessor: (r) => (
        <StatusBadge status={isOverdue(r.nextDueAt) ? 'pending_review' : 'scheduled'} />
      ),
      width: '120px',
    },
    {
      header: t('Recurrence', 'التكرار'),
      accessor: (r) => {
        const d = intervalByWh.get(r.warehouseId);
        return d ? `${d} ${t('days', 'يوم')}` : '—';
      },
      width: '100px',
    },
    {
      header: t('Counts', 'مرات'),
      accessor: (r) => <span className="font-mono text-xs">{r.completionCount}</span>,
      width: '64px',
      className: 'text-right',
    },
  ];

  const workerOptions = [
    { value: '', label: t('All workers', 'كل العمال') },
    ...(workersQuery.data ?? []).map((w) => ({ value: w.id, label: w.displayName })),
  ];

  const statusOptions = [
    { value: '', label: t('All statuses', 'كل الحالات') },
    { value: 'scheduled', label: t('Scheduled', 'مجدول') },
    { value: 'in_progress', label: t('In progress', 'قيد التنفيذ') },
    { value: 'pending_review', label: t('Pending review', 'بانتظار المراجعة') },
    { value: 'completed', label: t('Completed', 'مكتمل') },
    { value: 'cancelled', label: t('Cancelled', 'ملغي') },
  ];

  const yesNo = [
    { value: '', label: t('Any', 'الكل') },
    { value: 'yes', label: t('Yes', 'نعم') },
  ];

  return (
    <div>
      <PageHeader
        title={t('Cycle count', 'الجرد الدوري')}
        description={t(
          'Operational inventory verification — sessions, schedules, and discrepancies.',
          'التحقق التشغيلي من المخزون — الجلسات والجداول والفروقات.',
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExecute ? (
              <Link to="/cycle-count/my-tasks">
                <Button variant={isOperator ? 'primary' : 'secondary'}>
                  {isOperator ? t('My count tasks', 'مهام الجرد') : t('Worker view', 'واجهة العامل')}
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <FilterPanel
        title={t('Filters', 'الفلاتر')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={countsQuery.isFetching || historyQuery.isFetching}
        applyLabel={t('Apply', 'تطبيق')}
        resetLabel={t('Reset', 'إعادة')}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {tab === 'sessions' ? (
            <>
              <SelectField
                label={t('Status', 'الحالة')}
                name="status"
                value={draftFilters.status}
                onChange={(e) => setDraft({ status: e.target.value })}
                options={statusOptions}
              />
              <SelectField
                label={t('Assigned worker', 'العامل')}
                name="worker"
                value={draftFilters.assignedWorkerId}
                onChange={(e) => setDraft({ assignedWorkerId: e.target.value })}
                options={workerOptions}
              />
              <SelectField
                label={t('Discrepancy only', 'فروقات فقط')}
                name="disc"
                value={draftFilters.discrepancyOnly}
                onChange={(e) => setDraft({ discrepancyOnly: e.target.value })}
                options={yesNo}
              />
            </>
          ) : (
            <SelectField
              label={t('Overdue only', 'متأخر فقط')}
              name="overdue"
              value={draftFilters.overdueOnly}
              onChange={(e) => setDraft({ overdueOnly: e.target.value })}
              options={yesNo}
            />
          )}
          <TextField
            label={t('Date from', 'من تاريخ')}
            type="date"
            value={draftFilters.dateFrom}
            onChange={(e) => setDraft({ dateFrom: e.target.value })}
          />
          <TextField
            label={t('Date to', 'إلى تاريخ')}
            type="date"
            value={draftFilters.dateTo}
            onChange={(e) => setDraft({ dateTo: e.target.value })}
          />
        </div>
      </FilterPanel>

      <div className="mb-3 flex gap-1 border-b border-slate-200">
        {(['sessions', 'schedule'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-2 text-sm font-medium ${
              tab === key
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(key)}
          >
            {key === 'sessions'
              ? t('Count sessions', 'جلسات الجرد')
              : t('Product schedule', 'جدول المنتجات')}
          </button>
        ))}
      </div>

      {tab === 'sessions' ? (
        <DataTable<CycleCountListItem>
          columns={sessionCols}
          rows={filteredCounts}
          loading={countsQuery.isLoading}
          empty={t('No cycle counts for this warehouse.', 'لا توجد جلسات جرد.')}
          onRowClick={(r) => navigate(`/cycle-count/${r.id}`)}
          rowKey={(r) => r.id}
        />
      ) : (
        <DataTable<CycleCountProductHistoryRow>
          columns={scheduleCols}
          rows={filteredHistory}
          loading={historyQuery.isLoading}
          empty={t('No product count history yet.', 'لا يوجد سجل جرد للمنتجات.')}
          rowKey={(r) => r.id}
        />
      )}
    </div>
  );
}
