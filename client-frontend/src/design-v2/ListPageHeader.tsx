import type { ReactElement, ReactNode } from 'react';

export function ListPageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <i className={`fa-solid ${icon} text-emerald-600`} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
          {subtitle ? <p className="text-xs text-slate-500 truncate">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
