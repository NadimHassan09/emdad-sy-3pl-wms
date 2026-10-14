import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { OmsApi, type OmsBatchSummary } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { DataTable, type Column } from '../components/DataTable';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { QK } from '../constants/query-keys';
import { omsOperationalStageLabel } from '../lib/oms-operational-stage';

function useArabic() {
  return (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl')
  );
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Damascus',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stageLabel(batch: OmsBatchSummary, isArabic: boolean) {
  if (batch.stageKind === 'operational' && batch.stageKey) {
    return omsOperationalStageLabel(batch.stageKey, isArabic);
  }
  if (batch.stageKind === 'status' && batch.stageKey) {
    return <OmsStatusBadge status={batch.stageKey} isArabic={isArabic} />;
  }
  if (batch.stageKind === 'mixed') return isArabic ? 'متعدد' : 'Mixed';
  return '—';
}

export function OmsBatchesPage() {
  const isArabic = useArabic();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const query = useQuery({
    queryKey: [...QK.omsBatches, applied],
    queryFn: () => OmsApi.listBatches(applied),
  });
  const rows = query.data ?? [];
  const totals = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.orderCount > 0 && row.completedCount < row.orderCount).length,
      issues: rows.filter((row) => row.issueCount > 0).length,
      completed: rows.filter((row) => row.orderCount > 0 && row.completedCount === row.orderCount).length,
    }),
    [rows],
  );

  const columns: Column<OmsBatchSummary>[] = [
    {
      header: isArabic ? 'المجموعة' : 'Batch',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-text-strong">{row.batchNumber}</div>
          {row.name ? <div className="text-xs text-text-muted">{row.name}</div> : null}
        </div>
      ),
    },
    { header: isArabic ? 'الطلبات' : 'Orders', accessor: (row) => row.orderCount },
    { header: isArabic ? 'المرحلة الحالية' : 'Current stage', accessor: (row) => stageLabel(row, isArabic) },
    {
      header: isArabic ? 'التقدم' : 'Progress',
      accessor: (row) => (
        <div className="min-w-[140px]">
          <div className="mb-1 text-xs">
            {row.completedCount} / {row.orderCount}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full bg-emerald-600"
              style={{
                width: `${row.orderCount ? Math.round((row.completedCount / row.orderCount) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      header: isArabic ? 'المشكلات' : 'Issues',
      accessor: (row) => (
        <span className={row.issueCount ? 'font-semibold text-rose-600' : 'text-emerald-700'}>
          {row.issueCount}
        </span>
      ),
    },
    { header: isArabic ? 'أنشأها' : 'Created by', accessor: (row) => row.createdByName },
    { header: isArabic ? 'تاريخ الإنشاء' : 'Created at', accessor: (row) => formatWhen(row.createdAt) },
    {
      header: '',
      accessor: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/oms/batches/${row.id}`);
          }}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {isArabic ? 'فتح' : 'Open'}
        </button>
      ),
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-layer-group"
      title={isArabic ? 'المجموعات' : 'Batches'}
      subtitle={
        isArabic
          ? 'مجموعات محفوظة من الطلبات يمكن متابعتها عبر المراحل دون إعادة التحديد.'
          : 'Persistent groups of orders you can continue across stages without selecting them again.'
      }
      isArabic={isArabic}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label={isArabic ? 'كل المجموعات' : 'Total batches'} value={totals.total} />
        <Card label={isArabic ? 'قيد العمل' : 'Active batches'} value={totals.active} />
        <Card label={isArabic ? 'فيها مشكلات' : 'Batches with issues'} value={totals.issues} />
        <Card label={isArabic ? 'مكتملة' : 'Completed batches'} value={totals.completed} />
      </div>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={isArabic ? 'بحث برقم المجموعة أو الاسم' : 'Search by batch number or name'}
          className="w-full max-w-md rounded-lg border border-border-subtle px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold">
          {isArabic ? 'بحث' : 'Search'}
        </button>
      </form>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        onRowClick={(row) => navigate(`/oms/batches/${row.id}`)}
        empty={isArabic ? 'لا توجد مجموعات بعد.' : 'No batches yet.'}
      />
    </AdminListPageShell>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <div className="text-sm text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-text-strong">{value}</div>
    </div>
  );
}
