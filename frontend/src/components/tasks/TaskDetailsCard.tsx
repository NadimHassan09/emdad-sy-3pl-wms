import type { ReactNode } from 'react';

import { StatusBadge } from '../StatusBadge';

export type TaskDetailField = {
  iconClass: string;
  label: string;
  value: ReactNode;
};

function TaskDetailFieldRow({ iconClass, label, value }: TaskDetailField) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <i className={`${iconClass} text-[11px] text-emerald-600/90`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function TaskDetailsCard({
  taskTypeLabel,
  primaryTitle,
  subtitle,
  status,
  statusNode,
  iconClass = 'fa-solid fa-clipboard-list',
  fields,
  summary,
  summaryTitle = 'Summary',
}: {
  /** Task type shown above the primary title (e.g. Receiving). */
  taskTypeLabel: string;
  primaryTitle: ReactNode;
  subtitle?: ReactNode;
  status?: string;
  statusNode?: ReactNode;
  iconClass?: string;
  fields: TaskDetailField[];
  summary?: ReactNode;
  summaryTitle?: string;
}) {
  const summaryText =
    typeof summary === 'string' ? summary.trim() : summary == null ? '' : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-slate-50 ring-4 ring-slate-50"
          aria-hidden="true"
        >
          <i className={`${iconClass} text-xl text-emerald-600/80`} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {taskTypeLabel}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-900">{primaryTitle}</h2>
          {(subtitle || status || statusNode) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
              {subtitle ? <span>{subtitle}</span> : null}
              {subtitle && (status || statusNode) ? <span aria-hidden="true">·</span> : null}
              {statusNode ?? (status ? <StatusBadge status={status} /> : null)}
            </p>
          )}
        </div>
      </div>

      {fields.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold text-slate-800">Task information</h3>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <TaskDetailFieldRow key={f.label} {...f} />
            ))}
          </div>
        </>
      ) : null}

      {summary != null ? (
        <>
          <div className="mt-6 flex items-center gap-2">
            <i className="fa-regular fa-file-lines text-sm text-emerald-600/90" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-800">{summaryTitle}</h3>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
            {summaryText !== null ? (
              summaryText || <span className="text-slate-400">No notes for this task.</span>
            ) : (
              summary
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
