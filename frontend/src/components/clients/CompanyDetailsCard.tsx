import type { ReactNode } from 'react';

import type { CompanyListRow } from '../../api/companies';
import { adminMediaSrc } from '../../lib/admin-media';
import { StatusBadge } from '../StatusBadge';

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

function prettyDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function CompanyDetailField({
  iconClass,
  label,
  value,
}: {
  iconClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <i className={`${iconClass} text-[11px] text-status-success-fg/90`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
    </div>
  );
}

export function CompanyDetailsCard({ company }: { company: CompanyListRow }) {
  const summaryText = company.notes?.trim() ?? '';

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {adminMediaSrc(company.logoUrl) ? (
          <img
            src={adminMediaSrc(company.logoUrl) ?? undefined}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-4 ring-surface-sunken"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-surface-sunken ring-4 ring-surface-sunken dark:from-white/10"
            aria-hidden="true"
          >
            <i className="fa-solid fa-building text-xl text-status-success-fg/80" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-text-strong">{company.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-muted">
            {company.tradeName ? <span>{company.tradeName}</span> : null}
            {company.tradeName ? <span aria-hidden="true">·</span> : null}
            <span className="inline-flex">
              <StatusBadge status={company.status} />
            </span>
          </p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-text-strong">Company information</h3>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CompanyDetailField iconClass="fa-solid fa-envelope" label="Contact email" value={company.contactEmail} />
        <CompanyDetailField iconClass="fa-solid fa-phone" label="Phone" value={display(company.contactPhone)} />
        <CompanyDetailField iconClass="fa-solid fa-location-dot" label="City" value={display(company.city)} />
        <CompanyDetailField iconClass="fa-solid fa-globe" label="Country" value={display(company.country)} />
        <CompanyDetailField
          iconClass="fa-solid fa-file-invoice"
          label="Billing"
          value={`${company.billingCycle} · ${company.paymentTermsDays} days`}
        />
        <CompanyDetailField iconClass="fa-solid fa-map" label="Address" value={display(company.address)} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <i className="fa-regular fa-file-lines text-sm text-status-success-fg/90" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-text-strong">Summary</h3>
      </div>
      <div className="mt-3 rounded-xl bg-surface-sunken px-4 py-3.5 text-sm leading-relaxed text-text-body">
        {summaryText || <span className="text-text-faint">No notes for this company.</span>}
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Created {prettyDate(company.createdAt)} · Updated {prettyDate(company.updatedAt)}
      </p>
    </section>
  );
}
