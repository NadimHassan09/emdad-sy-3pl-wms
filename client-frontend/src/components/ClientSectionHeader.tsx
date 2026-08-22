import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ClientSectionHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: { to: string; label: string };
};

/** Compact section divider for page composition — avoids competing with page title. */
export function ClientSectionHeader({
  title,
  description,
  action,
}: ClientSectionHeaderProps): ReactElement {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--text-base)]">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="shrink-0 text-xs font-semibold text-brand-700 no-underline hover:text-brand-800 hover:underline underline-offset-2"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
