import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/AuthContext';
import { filterSectionSubNavItems, resolveSectionSubNav, sectionSubNavLabel } from '../lib/section-sub-nav';

type SectionSubNavCardProps = {
  isArabic?: boolean;
  /** Primary page action aligned to the right of the nav pills (e.g. + New inbound). */
  actions?: ReactNode;
};

/**
 * Horizontal sub-route nav — client-portal style pill track
 * (sunken grey capsule, white active button, dark text).
 */
export function SectionSubNavCard({ isArabic = false, actions }: SectionSubNavCardProps) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const section = resolveSectionSubNav(pathname);
  const t = (label: string) => sectionSubNavLabel(label, isArabic);

  const items = section ? filterSectionSubNavItems(section.items, user) : [];

  if (!section || items.length < 2) {
    if (!actions) return null;
    return (
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">{actions}</div>
    );
  }

  return (
    <nav aria-label={t(section.ariaLabelKey)} className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-surface-sunken p-1"
          role="list"
        >
          {items.map((item) => {
            const active = item.match(pathname, search);
            return (
              <Link
                key={item.to}
                to={item.to}
                role="listitem"
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:shadow-focus',
                  active
                    ? 'bg-white text-text-strong shadow-sm dark:bg-surface-panel'
                    : 'text-text-muted hover:text-text-strong',
                ].join(' ')}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </nav>
  );
}
