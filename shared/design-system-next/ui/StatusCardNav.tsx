import type { ReactElement } from 'react';

export type StatusCardItem = {
  value: string;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  count?: number;
  tone?: string;
  ring?: string;
  description?: string;
};

export type StatusCardNavProps = {
  items: StatusCardItem[];
  value: string;
  onChange: (value: string) => void;
  isArabic?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  gridClassName?: string;
};

export const STATUS_CARD_TONES = {
  slate: {
    tone: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
    ring: 'ring-slate-400',
  },
  emerald: {
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    ring: 'ring-emerald-500',
  },
  rose: {
    tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    ring: 'ring-rose-500',
  },
  amber: {
    tone: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    ring: 'ring-amber-500',
  },
  blue: {
    tone: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
    ring: 'ring-blue-500',
  },
  purple: {
    tone: 'border-purple-200 bg-purple-50 text-purple-950 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-100',
    ring: 'ring-purple-500',
  },
  cyan: {
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100',
    ring: 'ring-cyan-500',
  },
} as const;

const DEFAULT_TONE = STATUS_CARD_TONES.slate.tone;
const DEFAULT_RING = STATUS_CARD_TONES.slate.ring;

function formatCount(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US');
}

/**
 * Standardized status card navigation component matching the Admin OMS Orders reference design.
 * Provides accessible, responsive cards with soft tones, tabular counts, and ring indicators.
 */
export function StatusCardNav({
  items,
  value,
  onChange,
  isArabic = false,
  title,
  ariaLabel,
  className = '',
  gridClassName,
}: StatusCardNavProps): ReactElement {
  const selectedValue = value || '';
  const labelText = title || (isArabic ? 'الحالات العامة' : 'General statuses');
  const navAria = ariaLabel || labelText;

  // Compute adaptive grid columns based on number of cards if not specified
  const computedGrid =
    gridClassName ||
    (items.length <= 4
      ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-4'
      : items.length <= 6
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
        : items.length <= 8
          ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 2xl:grid-cols-10');

  return (
    <section aria-label={navAria} className={`my-3 ${className}`}>
      {title ? (
        <h2 className="mb-2 text-sm font-medium text-text-muted">{title}</h2>
      ) : null}
      <div
        role="group"
        aria-label={navAria}
        className={`flex snap-x gap-2.5 overflow-x-auto pb-1 md:grid ${computedGrid} md:overflow-visible`}
      >
        {items.map((item) => {
          const active = selectedValue === item.value;
          const displayLabel = isArabic
            ? item.labelAr ?? item.label ?? item.labelEn ?? item.value
            : item.labelEn ?? item.label ?? item.labelAr ?? item.value;
          const tone = item.tone || DEFAULT_TONE;
          const ring = item.ring || DEFAULT_RING;

          return (
            <button
              key={item.value || 'all'}
              type="button"
              role="button"
              aria-pressed={active}
              title={item.description || displayLabel}
              onClick={() => onChange(item.value)}
              className={[
                'flex min-h-16 min-w-36 shrink-0 snap-start flex-col items-start justify-between gap-1 rounded-xl border px-3.5 py-2.5 text-start transition md:min-w-0 cursor-pointer select-none',
                'hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2',
                tone,
                active
                  ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${ring}`
                  : 'opacity-90 hover:opacity-100',
              ].join(' ')}
            >
              <span className="text-xl font-semibold leading-6 tabular-nums">
                {formatCount(item.count)}
              </span>
              <span className="text-xs font-medium leading-4 line-clamp-1">
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
