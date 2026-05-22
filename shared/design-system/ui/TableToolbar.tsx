/**
 * TableToolbar — the chrome above a DataTable.
 *
 * Layout: [start slot] [title] [end slot]
 *   with an optional filter row below the header.
 *
 * The toolbar is intentionally NOT sticky — stickiness is applied by the
 * page container when needed. The calling component decides scroll context.
 *
 * RTL: all layout uses logical properties (ms-x, me-x).
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface TableToolbarProps {
  /** Section title (e.g. "Inbound Orders"). */
  title?: ReactNode;
  /** Slot on the inline-start side of the header row (e.g. SearchInput). */
  start?: ReactNode;
  /** Slot on the inline-end side of the header row (e.g. action buttons, DensityToggle). */
  end?: ReactNode;
  /** Additional full-width row below the header — for filter chips, FilterBar, etc. */
  filters?: ReactNode;
  /** Compact padding mode for tight pages. */
  compact?: boolean;
  className?: string;
}

export function TableToolbar({
  title,
  start,
  end,
  filters,
  compact,
  className,
}: TableToolbarProps) {
  const px = compact ? 'px-3' : 'px-4';
  const py = compact ? 'py-2' : 'py-3';
  return (
    <div className={cn('border-b border-slate-100 bg-white', className)}>
      {/* Header row */}
      <div className={cn('flex flex-wrap items-center gap-3', px, py)}>
        {/* Title */}
        {title && (
          <h2 className="m-0 me-auto whitespace-nowrap text-base font-semibold text-slate-900 sm:text-lg">
            {title}
          </h2>
        )}

        {/* Start slot (search, primary filter) */}
        {start && <div className={cn('flex items-center gap-2', !title && 'me-auto')}>{start}</div>}

        {/* End slot (actions, toggles) */}
        {end && <div className="flex items-center gap-2 ms-auto">{end}</div>}
      </div>

      {/* Filter row */}
      {filters && (
        <div className={cn('border-t border-neutral-100 bg-neutral-50', px, 'py-3')}>
          {filters}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DensityToggle — lets the user switch table density
// ─────────────────────────────────────────────────────────────────────────────

type Density = 'compact' | 'default' | 'comfortable';

interface DensityToggleProps {
  density: Density;
  onChange: (d: Density) => void;
}

const DENSITY_OPTIONS: { value: Density; label: string; icon: ReactNode }[] = [
  {
    value: 'compact',
    label: 'Compact',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1" y="2" width="14" height="2" rx="0.5" />
        <rect x="1" y="7" width="14" height="2" rx="0.5" />
        <rect x="1" y="12" width="14" height="2" rx="0.5" />
      </svg>
    ),
  },
  {
    value: 'default',
    label: 'Default',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1" y="2" width="14" height="3" rx="0.5" />
        <rect x="1" y="7.5" width="14" height="3" rx="0.5" />
        <rect x="1" y="12" width="7" height="2" rx="0.5" />
      </svg>
    ),
  },
  {
    value: 'comfortable',
    label: 'Comfortable',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1" y="1.5" width="14" height="4" rx="0.5" />
        <rect x="1" y="8.5" width="14" height="4" rx="0.5" />
      </svg>
    ),
  },
];

export function DensityToggle({ density, onChange }: DensityToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Table density"
      className="flex items-center rounded-lg border border-neutral-200 overflow-hidden bg-white"
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      {DENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={density === opt.value}
          aria-label={opt.label}
          title={opt.label}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-8 w-8 flex items-center justify-center',
            'transition-colors duration-fast ease-standard',
            'focus-visible:outline-none focus-visible:shadow-focus',
            density === opt.value
              ? 'bg-brand-50 text-brand-700'
              : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700',
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RefreshButton — shows a loading spinner when data is fetching
// ─────────────────────────────────────────────────────────────────────────────

interface RefreshButtonProps extends HTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  label?: string;
}

export function RefreshButton({ loading, label = 'Refresh', className, ...rest }: RefreshButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={loading}
      title={label}
      className={cn(
        'h-8 w-8 flex items-center justify-center rounded-md',
        'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
        'transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus',
        loading && 'opacity-60 cursor-wait',
        className,
      )}
      {...rest}
    >
      <svg
        width="15" height="15"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className={cn(loading && 'animate-spin')}
      >
        <path d="M4 10a6 6 0 1 0 .9-3M4 10V5.5M4 10H8.5" />
      </svg>
    </button>
  );
}
