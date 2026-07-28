/**
 * Compact page intro under the contextual topbar title.
 * Avoids a second competing h1 — uses h2 for the in-page heading.
 */

import type { ReactElement, ReactNode } from 'react';

type ClientPageIntroProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function ClientPageIntro({
  title,
  description,
  actions,
}: ClientPageIntroProps): ReactElement {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
