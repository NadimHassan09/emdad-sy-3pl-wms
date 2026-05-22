import type { WarehouseKpi } from '../../lib/reports/types';

const kpiCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition-[box-shadow,border-color] duration-fast hover:border-slate-200 hover:shadow-md sm:p-4';

type Props = {
  kpis: WarehouseKpi[];
  isArabic?: boolean;
  loading?: boolean;
};

export function ReportKpiGrid({ kpis, isArabic = false, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${kpiCardClass} animate-pulse`}>
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <div key={kpi.id} className={kpiCardClass}>
          <div className="text-xs text-slate-500">{isArabic ? kpi.labelAr : kpi.label}</div>
          <div className="mt-1 text-xl font-bold tabular-nums tracking-tight text-emerald-900">
            {kpi.value}
          </div>
          {(kpi.hint || kpi.hintAr) && (
            <p className="mt-1 text-xs text-slate-400">
              {isArabic ? (kpi.hintAr ?? kpi.hint) : (kpi.hint ?? kpi.hintAr)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
