import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type OrderWorkspaceSection = {
  id: string;
  label: string;
  disabled?: boolean;
  badge?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  backTo: string;
  backLabel: string;
  sections: OrderWorkspaceSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Order workspace shell — horizontal pill section nav (OMS Online-orders style).
 */
export function OrderWorkspaceLayout({
  title,
  subtitle,
  statusBadge,
  backTo,
  backLabel,
  sections,
  activeSection,
  onSectionChange,
  headerActions,
  children,
  footer,
}: Props) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col animate-enter">
      <header className="sticky top-0 z-20 border-b border-border bg-surface-panel/95 backdrop-blur-sm">
        <div className="px-1 py-4 sm:px-2">
          <Link
            to={backTo}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {backLabel}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-text-strong">{title}</h1>
                {statusBadge}
              </div>
              {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
            </div>
            {headerActions ? (
              <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
            ) : null}
          </div>

          <nav className="mt-4" aria-label="Order workspace sections">
            <div className="flex flex-wrap gap-1" role="list">
              {sections.map((section) => {
                const active = section.id === activeSection;
                const disabled = section.disabled === true;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="listitem"
                    disabled={disabled}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => !disabled && onSectionChange(section.id)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition',
                      'focus-visible:outline-none focus-visible:shadow-focus',
                      disabled
                        ? 'cursor-not-allowed text-text-disabled opacity-50'
                        : active
                          ? 'bg-surface-sunken text-text-strong'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text-strong',
                    ].join(' ')}
                  >
                    {section.label}
                    {section.badge ? (
                      <span className="rounded-full bg-surface-panel px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                        {section.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="min-w-0 flex-1 p-4 sm:p-5">{children}</main>

      {footer ? (
        <footer className="sticky bottom-0 z-20 border-t border-border bg-surface-panel/95 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
