import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { canAccessPath } from '../lib/rbac';
import { resolveSectionSubNav, sectionSubNavLabel } from '../lib/section-sub-nav';

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

  const items = section?.items.filter((item) => canAccessPath(user?.role, item.to)) ?? [];

  if (!section || items.length < 2) return null;

  return (
    <nav
      aria-label={t(section.ariaLabelKey)}
      className="mb-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
    >
      <div className="flex flex-wrap gap-2" role="list">
        {items.map((item) => {
          const active = item.match(pathname, search);
          return (
            <Link
              key={item.to}
              to={item.to}
              role="listitem"
              aria-current={active ? 'page' : undefined}
              className={[
                'inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition',
                active
                  ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
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
