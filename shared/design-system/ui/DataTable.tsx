/**
 * DataTable — enterprise-grade operational table primitive.
 *
 * Design constraints (WMS spec §H.2 & §H.3):
 *   - Row height fixed per density tier (compact 40px / default 52px / comfortable 64px)
 *   - Sticky header — operators must always see column context
 *   - First-column identifiers (order #, SKU) can be sticky
 *   - Numeric columns use font-mono + end alignment for vertical digit alignment
 *   - Row states (warning / error / locked / muted) add left-border + background tint
 *   - Skeleton loading prevents layout shift
 *   - Empty state uses the EmptyState primitive
 *   - Sorting exposed via aria-sort + visual indicators
 *   - All spacing uses logical CSS properties (RTL-safe)
 *   - No physical `left/right` margin/padding in this file
 *
 * Does NOT own pagination — use the `Pagination` primitive in the toolbar footer.
 */

import {
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Align = 'start' | 'end' | 'center';
type Density = 'compact' | 'default' | 'comfortable';
export type SortDir = 'asc' | 'desc';

/** Per-row operational state — maps to a border + background tint (§B.4). */
export type RowState =
  | 'default'
  | 'warning'    // amber: shortfall, expiry-warning
  | 'error'      // red: cancelled, expired
  | 'locked'     // amber+: lease active
  | 'muted'      // neutral: archived / suspended
  | 'new';       // brand flash: just arrived via socket (fades to default)

export interface Column<T> {
  /** Unique key — used as the sort key and React key. */
  key: string;
  /** Header cell content. */
  header: ReactNode;
  /** Cell renderer. */
  accessor: (row: T, index: number) => ReactNode;
  /** Fixed column width (CSS value). */
  width?: string;
  /** Minimum column width. */
  minWidth?: string;
  /** Text alignment within cells — defaults to `start`. */
  align?: Align;
  /**
   * Numeric shorthand: switches to `font-mono` and `end` alignment.
   * Overrides `align`.
   */
  numeric?: boolean;
  /** Whether this column is sortable (shows sort indicator). */
  sortable?: boolean;
  /**
   * Stick this column to the inline-start edge of the table.
   * Typically used for the identifier column (Order #, SKU).
   */
  sticky?: boolean;
  /** Additional className for all body cells in this column. */
  className?: string;
  /** Additional className for the header cell. */
  headerClassName?: string;
  /** Hide the column without removing it from the DOM (column visibility toggle). */
  hidden?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  // ── Loading & empty ──────────────────────────────────────────────────────
  loading?: boolean;
  /** How many skeleton rows to show while loading. Defaults to 8. */
  skeletonRows?: number;
  /** Custom empty state — passed to EmptyState when rows is empty and not loading. */
  empty?: ReactNode;
  /** Icon shown in the built-in empty state. */
  emptyIcon?: ReactNode;
  /** Title shown in the built-in empty state. */
  emptyTitle?: string;
  /** Description shown in the built-in empty state. */
  emptyDescription?: string;
  /** Action shown in the built-in empty state. */
  emptyAction?: ReactNode;

  // ── Row interaction ───────────────────────────────────────────────────────
  onRowClick?: (row: T) => void;
  /** Return a RowState to apply a visual treatment to a specific row. */
  rowState?: (row: T) => RowState;

  // ── Sorting ───────────────────────────────────────────────────────────────
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string, dir: SortDir) => void;

  // ── Layout & density ─────────────────────────────────────────────────────
  density?: Density;
  /** Stick the header row during vertical scroll. Default true. */
  stickyHeader?: boolean;
  /**
   * Subtle alternating-row background tint — improves scanability for wide
   * tables with many columns. Does NOT apply to rows with an explicit rowState.
   */
  zebra?: boolean;
  /** Additional className for the outer wrapper. */
  className?: string;

  // ── Accessibility ─────────────────────────────────────────────────────────
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────

const DENSITY_ROW_H: Record<Density, string> = {
  compact:     'h-10',
  default:     '',
  comfortable: 'min-h-16',
};

const DENSITY_CELL_PX: Record<Density, string> = {
  compact:     'px-3 py-2',
  default:     'px-6 py-5',
  comfortable: 'px-6 py-5',
};

const DENSITY_HEADER_PX: Record<Density, string> = {
  compact:     'px-3 py-2',
  default:     'px-6 py-4',
  comfortable: 'px-6 py-4',
};

const ALIGN_CLASS: Record<Align, string> = {
  start:  'text-start',
  end:    'text-end',
  center: 'text-center',
};

const ROW_STATE_STYLES: Record<RowState, string> = {
  default: '',
  warning: 'bg-warning-50 border-s-[3px] border-warning-400',
  error:   'bg-danger-50 border-s-[3px] border-danger-400',
  locked:  'bg-warning-50 border-s-[3px] border-warning-400',
  muted:   'bg-neutral-50 opacity-70',
  new:     'animate-[rowFlash_2s_ease-out_forwards]',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Th({
  children,
  className,
  colAlign = 'start',
  sticky,
  sortable,
  sorted,
  sortDir,
  onSort,
  width,
  minWidth,
  ...rest
}: {
  children: ReactNode;
  colAlign?: Align;
  sticky?: boolean;
  sortable?: boolean;
  sorted?: boolean;
  sortDir?: SortDir;
  onSort?: () => void;
  width?: string;
  minWidth?: string;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'>) {
  const align = colAlign;
  const isDir = sorted ? sortDir : undefined;
  return (
    <th
      scope="col"
      aria-sort={sortable ? (isDir === 'asc' ? 'ascending' : isDir === 'desc' ? 'descending' : 'none') : undefined}
      className={cn(
        'bg-slate-100 text-slate-500',
        'text-sm font-medium uppercase tracking-wide whitespace-nowrap',
        ALIGN_CLASS[align],
        sticky && 'sticky start-0 z-raised bg-slate-100 after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-slate-200',
        sortable && 'cursor-pointer select-none hover:text-slate-700',
        className,
      )}
      style={{ width, minWidth }}
      onClick={sortable ? onSort : undefined}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'end' && 'flex-row-reverse')}>
        {children}
        {sortable && (
          <span className="inline-flex flex-col" aria-hidden="true">
            <SortArrow dir="asc" active={sorted && sortDir === 'asc'} />
            <SortArrow dir="desc" active={sorted && sortDir === 'desc'} />
          </span>
        )}
      </span>
    </th>
  );
}

function SortArrow({ dir, active }: { dir: 'asc' | 'desc'; active?: boolean }) {
  return (
    <svg
      width="8" height="5"
      viewBox="0 0 8 5"
      className={cn('block', active ? 'text-brand-600' : 'text-neutral-300')}
      fill="currentColor"
    >
      {dir === 'asc'
        ? <path d="M4 0L8 5H0L4 0Z" />
        : <path d="M4 5L0 0H8L4 5Z" />
      }
    </svg>
  );
}

function Td({
  children,
  className,
  colAlign = 'start',
  numeric,
  sticky,
  ...rest
}: {
  colAlign?: Align;
  numeric?: boolean;
  sticky?: boolean;
} & Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'>) {
  const align = colAlign;
  return (
    <td
      className={cn(
        'align-middle',
        numeric ? 'font-mono text-slate-800' : 'text-slate-600',
        ALIGN_CLASS[numeric ? 'end' : align],
        sticky && 'sticky start-0 z-raised bg-inherit after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-slate-200',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton row
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow<T>({
  columns,
  density,
}: {
  columns: Column<T>[];
  density: Density;
}) {
  const visibleCols = columns.filter((c) => !c.hidden);
  return (
    <tr className={DENSITY_ROW_H[density]}>
      {visibleCols.map((col) => (
        <td
          key={col.key}
          className={DENSITY_CELL_PX[density]}
        >
          <Skeleton
            height={density === 'compact' ? 12 : density === 'comfortable' ? 18 : 14}
            width={col.width ? '100%' : col.numeric ? '4rem' : '75%'}
          />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DataTable component
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  skeletonRows = 8,
  empty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  rowState,
  sortKey,
  sortDir,
  onSort,
  density = 'default',
  stickyHeader = true,
  zebra,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: DataTableProps<T>) {
  const visibleCols = columns.filter((c) => !c.hidden);
  const isClickable = !!onRowClick;
  const isEmpty = !loading && rows.length === 0;

  function handleSort(key: string) {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'asc');
    }
  }

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm',
        className,
      )}
    >
      <div className="w-full overflow-x-auto">
        <table
          role="grid"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-busy={loading}
          className="min-w-full border-collapse"
        >
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <Th
                  key={col.key}
                  colAlign={col.numeric ? 'end' : (col.align ?? 'start')}
                  sticky={col.sticky}
                  sortable={col.sortable}
                  sorted={sortKey === col.key}
                  sortDir={sortDir}
                  onSort={() => handleSort(col.key)}
                  width={col.width}
                  minWidth={col.minWidth}
                  className={cn(
                    DENSITY_HEADER_PX[density],
                    stickyHeader && 'sticky top-0 z-sticky',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </Th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} density={density} />
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={visibleCols.length} className="p-0">
                  {empty ?? (
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle ?? 'No results found'}
                      description={emptyDescription}
                      action={emptyAction}
                      size="sm"
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const state = rowState ? rowState(row) : 'default';
                const key = rowKey(row);
                const hasState = state !== 'default';
                return (
                  <tr
                    key={key}
                    role={isClickable ? 'row' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-selected={undefined}
                    data-row-index={index}
                    onClick={isClickable ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      DENSITY_ROW_H[density],
                      /* Smooth row hover — GPU-friendly background-color transition */
                      'border-t border-slate-100',
                      isClickable &&
                        'cursor-pointer transition-[background-color] duration-fast ease-standard hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:bg-emerald-50/50',
                      /* Zebra stripe — only on rows without an explicit state */
                      zebra && !hasState && index % 2 === 1 && 'bg-neutral-50/60',
                      ROW_STATE_STYLES[state],
                    )}
                  >
                    {visibleCols.map((col) => (
                      <Td
                        key={col.key}
                        colAlign={col.align}
                        numeric={col.numeric}
                        sticky={col.sticky}
                        className={cn(DENSITY_CELL_PX[density], col.className)}
                      >
                        {col.accessor(row, index)}
                      </Td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DataTableContainer — wraps a DataTable + toolbar + pagination into a
 * single bordered section. Use when you need all three together.
 */
export function DataTableContainer({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
