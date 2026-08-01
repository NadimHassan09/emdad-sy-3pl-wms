import { Link, useLocation } from 'react-router-dom';

import { resolveSectionSubNav } from '../lib/section-sub-nav';

type SectionSubNavCardProps = {
  isArabic?: boolean;
};

export function SectionSubNavCard({ isArabic = false }: SectionSubNavCardProps) {
  const { pathname } = useLocation();
  const section = resolveSectionSubNav(pathname);

  if (!section || section.items.length < 2) return null;

  return (
    <nav
      aria-label={isArabic ? section.ariaLabelAr : section.ariaLabel}
      className="mb-3 rounded-xl border border-border-subtle bg-surface-card p-1.5 shadow-sm sm:p-2"
    >
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {section.items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.to} className="min-w-0">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition sm:px-4 sm:py-2',
                  'focus-visible:outline-none focus-visible:shadow-focus',
                  active
                    ? 'bg-cta text-white shadow-sm hover:bg-cta-hover'
                    : 'text-text-body hover:bg-surface-hover',
                ].join(' ')}
              >
                {isArabic ? item.labelAr : item.labelKey}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
