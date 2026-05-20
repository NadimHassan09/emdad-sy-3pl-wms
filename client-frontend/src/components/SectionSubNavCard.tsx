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
      className="mb-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap gap-2" role="list">
        {section.items.map((item) => {
          const active = item.match(pathname);
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
              {isArabic ? item.labelAr : item.labelKey}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
