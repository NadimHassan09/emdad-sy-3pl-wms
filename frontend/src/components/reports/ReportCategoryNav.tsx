import { cn } from '@ds';

import { REPORT_CATEGORY_META, type ReportCategory, type ReportDefinition } from '../../lib/reports/types';

type Props = {
  reports: ReportDefinition[];
  activeId: string;
  isArabic: boolean;
  onSelect: (id: string) => void;
};

export function ReportCategoryNav({ reports, activeId, isArabic, onSelect }: Props) {
  const categories: ReportCategory[] = ['inventory', 'orders', 'operations', 'clients'];

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const items = reports.filter((r) => r.category === cat);
        if (!items.length) return null;
        const meta = REPORT_CATEGORY_META[cat];
        return (
          <div key={cat}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {isArabic ? meta.labelAr : meta.label}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((r) => {
                const active = r.id === activeId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className={cn(
                      'min-w-[11rem] shrink-0 rounded-xl border px-4 py-3 text-start transition-all duration-fast',
                      active
                        ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-sm font-semibold',
                        active ? 'text-emerald-900' : 'text-slate-900',
                      )}
                    >
                      {isArabic ? r.titleAr : r.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {isArabic ? r.descriptionAr : r.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
