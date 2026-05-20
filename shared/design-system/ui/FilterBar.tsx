/**
 * FilterBar — collapsible filter panel that sits in the TableToolbar.
 *
 * Features:
 *   - Toggle show/hide with animated collapse
 *   - Shows "N active" badge when filters are applied
 *   - Apply / Reset actions via FilterBarActions sub-component
 *   - Responsive: stacks vertically on small screens
 *   - Accessible: toggle button has aria-expanded
 *
 * Usage:
 *   <TableToolbar
 *     filters={
 *       <FilterBar
 *         activeCount={activeFilters}
 *         actions={<FilterBarActions onApply={apply} onReset={reset} loading={isFetching} />}
 *       >
 *         <Input label="Order #" ... />
 *         <Select label="Status" ... />
 *       </FilterBar>
 *     }
 *   />
 *
 * Alternatively, use FilterBarToggle separately (e.g., in toolbar end slot):
 *   end={<FilterBarToggle open={open} onToggle={setOpen} activeCount={n} />}
 */

import {
  type ReactNode,
  useState,
  useId,
} from 'react';
import { cn } from './cn';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { Badge } from './Badge';

// ─────────────────────────────────────────────────────────────────────────────
// FilterBarToggle — standalone toggle button for the toolbar end slot
// ─────────────────────────────────────────────────────────────────────────────

interface FilterBarToggleProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  activeCount?: number;
  openLabel?: string;
  closeLabel?: string;
}

export function FilterBarToggle({
  open,
  onToggle,
  activeCount,
  openLabel = 'Filters',
  closeLabel = 'Hide filters',
}: FilterBarToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={open ? closeLabel : openLabel}
      onClick={() => onToggle(!open)}
      className={cn(
        'inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium',
        'border transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus',
        open
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
      )}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      {/* Filter icon */}
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
        <path d="M3 5h14M6 10h8M9 15h2" />
      </svg>
      <span>{open ? closeLabel : openLabel}</span>
      {activeCount != null && activeCount > 0 && (
        <span
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-pill bg-brand-600 px-1 text-[10px] font-semibold text-white"
          aria-label={`${activeCount} active filters`}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterBarActions — Apply + Reset row at the bottom of the filter area
// ─────────────────────────────────────────────────────────────────────────────

interface FilterBarActionsProps {
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
  applyLabel?: string;
  resetLabel?: string;
  /** When true, shows an "active count" badge next to the reset button. */
  activeCount?: number;
}

export function FilterBarActions({
  onApply,
  onReset,
  loading,
  applyLabel = 'Apply filters',
  resetLabel = 'Clear filters',
  activeCount,
}: FilterBarActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-200 mt-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={loading}
        onClick={onApply}
      >
        {applyLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={loading}
        onClick={onReset}
      >
        {resetLabel}
        {activeCount != null && activeCount > 0 && (
          <Badge tone="neutral" size="xs" className="ms-1">{activeCount}</Badge>
        )}
      </Button>
      {loading && <Spinner size="sm" className="text-neutral-400" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterBar — collapsible container with embedded open/close state
// ─────────────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  /** Number of currently active (applied) filters — shown on the toggle button. */
  activeCount?: number;
  /** Optional: override open state (controlled mode). */
  open?: boolean;
  /** Callback for controlled mode. */
  onOpenChange?: (open: boolean) => void;
  /** Start closed by default. */
  defaultOpen?: boolean;
  openLabel?: string;
  closeLabel?: string;
  /** Apply / Reset actions — use FilterBarActions. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FilterBar({
  activeCount,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  openLabel = 'Show filters',
  closeLabel = 'Hide filters',
  actions,
  children,
  className,
}: FilterBarProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange ? onOpenChange(next) : setUncontrolledOpen(next);
  };

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {/* Toggle button row */}
      <FilterBarToggle
        open={isOpen}
        onToggle={setOpen}
        activeCount={activeCount}
        openLabel={openLabel}
        closeLabel={closeLabel}
      />

      {/* Collapsible body */}
      {isOpen && (
        <div
          id={bodyId}
          role="region"
          aria-label="Filters"
          className="mt-3 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {children}
          </div>
          {actions}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusFilter — a select specifically for status filtering (Section B.3)
// ─────────────────────────────────────────────────────────────────────────────

interface StatusOption {
  value: string;
  label: string;
}

interface StatusFilterProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: StatusOption[];
  allLabel?: string;
  disabled?: boolean;
}

export function StatusFilter({
  label = 'Status',
  value,
  onChange,
  options,
  allLabel = 'All statuses',
  disabled,
}: StatusFilterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'h-10 w-full bg-white border border-neutral-300 rounded-lg',
          'ps-3 pe-9 text-sm text-neutral-900',
          'appearance-none',
          'transition-colors duration-fast',
          'focus:border-brand-600 focus:shadow-focus focus:outline-none',
          disabled && 'opacity-60 cursor-not-allowed bg-neutral-50',
        )}
        style={{
          borderRadius: 'var(--radius-input)',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/></svg>\")",
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1rem 1rem',
          backgroundPosition: 'right 0.75rem center',
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
