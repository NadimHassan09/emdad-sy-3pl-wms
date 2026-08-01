import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { filterSectionSubNavItems, resolveSectionSubNav, sectionSubNavLabel } from '../lib/section-sub-nav';

type SectionSubNavCardProps = {
  isArabic?: boolean;
};

/**
 * Horizontal sub-route nav — OMS-style soft pills (active = sunken gray, inactive = text).
 */
export function SectionSubNavCard({ isArabic = false }: SectionSubNavCardProps) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const section = resolveSectionSubNav(pathname);
  const t = (label: string) => sectionSubNavLabel(label, isArabic);

  const items = section ? filterSectionSubNavItems(section.items, user) : [];

  if (!section || items.length < 2) return null;

  return (
    <nav aria-label={t(section.ariaLabelKey)} className="mb-4">
      <div className="flex flex-wrap gap-1" role="list">
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
                'focus-visible:outline-none focus-visible:shadow-focus',
                active
                  ? 'bg-surface-sunken text-text-strong'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-strong',
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
