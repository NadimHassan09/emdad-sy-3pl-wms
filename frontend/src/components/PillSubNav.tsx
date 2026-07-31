import { Link, NavLink } from 'react-router-dom';

export type PillSubNavItem =
  | {
      key: string;
      label: string;
      to: string;
      active?: boolean;
    }
  | {
      key: string;
      label: string;
      onClick: () => void;
      active?: boolean;
    };

type PillSubNavProps = {
  items: PillSubNavItem[];
  ariaLabel: string;
  className?: string;
};

const pillClass = (active: boolean) =>
  [
    'inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition',
    active
      ? 'bg-cta text-on-brand shadow-sm hover:bg-cta-hover'
      : 'border border-border text-text-muted hover:bg-surface-hover',
  ].join(' ');

/**
 * Horizontal pill navigation — matches Inbound Orders section sub-nav styling.
 */
export function PillSubNav({ items, ariaLabel, className = 'mb-4' }: PillSubNavProps) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`rounded-xl border border-border-subtle bg-surface-panel p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap gap-2" role="list">
        {items.map((item) => {
          if ('to' in item) {
            const active = item.active;
            if (active != null) {
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  role="listitem"
                  aria-current={active ? 'page' : undefined}
                  className={pillClass(active)}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <NavLink
                key={item.key}
                to={item.to}
                role="listitem"
                className={({ isActive }) => pillClass(isActive)}
              >
                {item.label}
              </NavLink>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              role="listitem"
              aria-current={item.active ? 'page' : undefined}
              className={pillClass(!!item.active)}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
