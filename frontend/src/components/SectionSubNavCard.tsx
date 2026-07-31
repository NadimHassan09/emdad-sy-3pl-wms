import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { filterSectionSubNavItems, resolveSectionSubNav, sectionSubNavLabel } from '../lib/section-sub-nav';

type SectionSubNavCardProps = {
  isArabic?: boolean;
};

/**
 * Horizontal sub-route nav in a white card — shown above page content (filters/table)
 * when the current section has multiple sibling routes (inventory, orders, tasks).
 */
export function SectionSubNavCard({ isArabic = false }: SectionSubNavCardProps) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const section = resolveSectionSubNav(pathname);
  const t = (label: string) => sectionSubNavLabel(label, isArabic);

  const items = section ? filterSectionSubNavItems(section.items, user) : [];

  if (!section || items.length < 2) return null;

  return (
    <nav
      aria-label={t(section.ariaLabelKey)}
      className="mb-4 rounded-xl border border-border bg-surface-panel p-2 shadow-soft"
    >
      <div className="flex flex-wrap gap-1.5" role="list">
        {items.map((item) => {
          const active = item.match(pathname, search);
          return (
            <Link
              key={item.to}
              to={item.to}
              role="listitem"
              aria-current={active ? 'page' : undefined}
              className={[
                'inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium transition',
                'focus-visible:outline-none focus-visible:shadow-focus',
                active
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/40 dark:text-brand-400 dark:ring-brand-800'
                  : 'text-text-muted hover:bg-surface-hover',
              ].join(' ')}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
