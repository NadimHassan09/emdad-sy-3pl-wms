import { NavLink } from 'react-router-dom';

import { cn } from '@ds';

import { REPORT_CATALOG, type ReportCatalogEntry } from '../../lib/reports/report-catalog';

type Props = {
  isArabic?: boolean;
};

export function ReportsNav({ isArabic = false }: Props) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Reports">
      {REPORT_CATALOG.map((entry: ReportCatalogEntry) => (
        <NavLink
          key={entry.id}
          to={entry.path}
          className={({ isActive }) =>
            cn(
              'min-w-[11rem] shrink-0 rounded-xl border px-4 py-3 text-start transition-all duration-fast',
              isActive
                ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'block text-sm font-semibold',
                  isActive ? 'text-emerald-900' : 'text-slate-900',
                )}
              >
                {isArabic ? entry.titleAr : entry.title}
              </span>
              <span className="mt-1 line-clamp-2 text-xs text-slate-500">
                {isArabic ? entry.descriptionAr : entry.description}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
