/**
 * Shared premium shell for client order/invoice detail pages.
 */

import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@ds';

type ClientDetailShellProps = {
  backTo: string;
  backLabel: string;
  loading?: boolean;
  loadingLabel?: string;
  errorTitle?: string | null;
  errorDescription?: string | null;
  notFound?: boolean;
  notFoundTitle?: string;
  notFoundDescription?: string;
  title?: ReactNode;
  status?: ReactNode;
  banner?: ReactNode;
  children?: ReactNode;
};

export function ClientDetailShell({
  backTo,
  backLabel,
  loading,
  loadingLabel = 'Loading…',
  errorTitle,
  errorDescription,
  notFound,
  notFoundTitle = 'Not found',
  notFoundDescription = 'This record is not available or you do not have access.',
  title,
  status,
  banner,
  children,
}: ClientDetailShellProps): ReactElement {
  return (
    <div className="space-y-3">
      <nav aria-label="Breadcrumb">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
        >
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          {backLabel}
        </Link>
      </nav>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]">
        {notFound ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              icon={<i className="fa-solid fa-circle-exclamation text-2xl" aria-hidden="true" />}
              title={notFoundTitle}
              description={notFoundDescription}
              action={
                <Link to={backTo} className="btn btn--primary">
                  {backLabel}
                </Link>
              }
            />
          </div>
        ) : errorTitle ? (
          <div className="p-4 sm:p-5">
            <div
              className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-900"
              role="alert"
            >
              <p className="font-semibold">{errorTitle}</p>
              {errorDescription ? <p className="mt-1 text-danger-800">{errorDescription}</p> : null}
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3 p-4 sm:p-5" aria-busy="true" aria-live="polite">
            <div className="h-7 w-56 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-xl bg-neutral-50" />
            <div className="h-36 animate-pulse rounded-xl bg-neutral-50" />
            <span className="sr-only">{loadingLabel}</span>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            {(title || status) && (
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-3.5 sm:gap-3">
                {title ? (
                  <h1 className="text-lg font-semibold tracking-tight text-[var(--text-strong)] sm:text-xl">
                    {title}
                  </h1>
                ) : null}
                {status}
              </div>
            )}
            {banner}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

type DetailGridProps = {
  children: ReactNode;
};

export function DetailGrid({ children }: DetailGridProps): ReactElement {
  return <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>;
}

type DetailFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
  /** Primary fields get stronger value weight */
  emphasize?: boolean;
};

export function DetailField({
  label,
  children,
  className = '',
  emphasize = false,
}: DetailFieldProps): ReactElement {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        emphasize
          ? 'border-brand-200 bg-brand-50/40'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'
      } ${className}`}
    >
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-sm ${
          emphasize ? 'font-semibold text-[var(--text-strong)]' : 'font-medium text-[var(--text-strong)]'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function DetailSection({ title, children, action }: DetailSectionProps): ReactElement {
  return (
    <section className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
