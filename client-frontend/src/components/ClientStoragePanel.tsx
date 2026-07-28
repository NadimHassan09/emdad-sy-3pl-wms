/**
 * Storage capacity panel with utilization donut — presentational only.
 */

import type { ReactElement } from 'react';

export function ClientStoragePanel({
  percent,
  usedVolume,
  reservedVolume,
  usedWeight,
  reservedWeight,
  unitCbm,
  unitKg,
  usedLabel,
  capacityLabel,
  weightLabel,
  reservedWeightLabel,
  loading,
}: {
  percent: number | null;
  usedVolume: string;
  reservedVolume: string;
  usedWeight: string;
  reservedWeight: string;
  unitCbm: string;
  unitKg: string;
  usedLabel: string;
  capacityLabel: string;
  weightLabel: string;
  reservedWeightLabel: string;
  loading?: boolean;
}): ReactElement {
  const p = percent != null ? Math.max(0, Math.min(100, percent)) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (p / 100) * circ;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="relative mx-auto h-[132px] w-[132px] shrink-0 sm:mx-0"
        role="img"
        aria-label={
          percent != null ? `${usedLabel}: ${p}%` : usedLabel
        }
      >
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-full bg-neutral-100" />
        ) : (
          <>
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-neutral-100)" strokeWidth="12" />
              <circle
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke="var(--color-brand-500)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={percent == null ? circ : offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums text-[var(--text-strong)]">
                {percent != null ? `${p}%` : '—'}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          [usedLabel, `${usedVolume} ${unitCbm}`],
          [capacityLabel, `${reservedVolume} ${unitCbm}`],
          [weightLabel, `${usedWeight} ${unitKg}`],
          [reservedWeightLabel, `${reservedWeight} ${unitKg}`],
        ].map(([k, v]) => (
          <div
            key={String(k)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              {k}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              {loading ? '…' : v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal inbound vs outbound comparison bars. */
export function ClientOrderMixBars({
  inbound,
  outbound,
  inboundLabel,
  outboundLabel,
  loading,
}: {
  inbound: number;
  outbound: number;
  inboundLabel: string;
  outboundLabel: string;
  loading?: boolean;
}): ReactElement {
  const total = Math.max(inbound + outbound, 1);
  const inPct = Math.round((inbound / total) * 100);
  const outPct = Math.round((outbound / total) * 100);

  return (
    <div className="space-y-4">
      {[
        { label: inboundLabel, value: inbound, pct: inPct, tone: 'bg-brand-500' },
        { label: outboundLabel, value: outbound, pct: outPct, tone: 'bg-accent-500' },
      ].map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-base)]">{row.label}</span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              {loading ? '…' : row.value.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100" role="presentation">
            <div
              className={`h-full rounded-full ${row.tone} transition-all duration-500`}
              style={{ width: loading ? '0%' : `${row.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
