/**
 * WorkflowStatus — compact order/task lifecycle progress visualization.
 *
 * Renders a horizontal stepper strip showing where a record sits in its
 * operational lifecycle. Used in:
 *   - Order detail headers (inbound / outbound)
 *   - Task detail views
 *   - Dashboard activity rows
 *
 * Design rules:
 *   - Compact enough to sit in a page-header meta row or a table detail panel
 *   - Current step is emphasized; past steps are "done"; future steps are muted
 *   - Separator line connects steps — grows/fills for past steps
 *   - Cancelled / blocked step shown in danger red when `error` flag set
 *   - RTL-safe: uses logical flex direction with `dir` detection
 *   - Prefers CSS over JS animation — the progress line uses `width` transition
 *   - Reduced-motion: transitions disabled automatically via global CSS guard
 *
 * Usage:
 *   <WorkflowStatus
 *     steps={[
 *       { key: 'draft',       label: 'Draft' },
 *       { key: 'confirmed',   label: 'Confirmed' },
 *       { key: 'receiving',   label: 'Receiving' },
 *       { key: 'completed',   label: 'Completed' },
 *     ]}
 *     current="receiving"
 *   />
 */

import type { HTMLAttributes } from 'react';
import { cn } from './cn';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  key: string;
  label: string;
  /** Short Arabic label — rendered when document dir is rtl. */
  labelAr?: string;
}

export interface WorkflowStatusProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  steps: WorkflowStep[];
  /** Key of the currently active step. */
  current: string;
  /** If true, renders the current and subsequent steps in danger styling. */
  error?: boolean;
  /** If true, renders all completed steps in muted style (cancelled state). */
  cancelled?: boolean;
  /** Size — default `sm` suits page-header meta rows; `xs` for table cells. */
  size?: 'xs' | 'sm';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type StepState = 'done' | 'current' | 'upcoming';

function getState(
  idx: number,
  currentIdx: number,
  cancelled: boolean,
): StepState {
  if (cancelled) return idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
  if (idx < currentIdx) return 'done';
  if (idx === currentIdx) return 'current';
  return 'upcoming';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function WorkflowStatus({
  steps,
  current,
  error,
  cancelled,
  size = 'sm',
  className,
  ...rest
}: WorkflowStatusProps) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  const effectiveCurrentIdx = currentIdx === -1 ? 0 : currentIdx;
  const isRtl =
    typeof document !== 'undefined' &&
    document.documentElement.dir === 'rtl';

  const dotSize = size === 'xs' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const labelSize = size === 'xs' ? 'text-[10px]' : 'text-2xs';
  const lineH = size === 'xs' ? 'h-px' : 'h-px';

  return (
    <div
      className={cn('flex items-start gap-0', className)}
      aria-label={`Workflow: step ${effectiveCurrentIdx + 1} of ${steps.length}`}
      {...rest}
    >
      {steps.map((step, idx) => {
        const state = getState(idx, effectiveCurrentIdx, cancelled ?? false);
        const isLast = idx === steps.length - 1;
        const label = isRtl && step.labelAr ? step.labelAr : step.label;

        // Dot colors
        const dotCn = cn(
          'rounded-full shrink-0 transition-all duration-base ease-standard',
          dotSize,
          state === 'done' && !cancelled && 'bg-brand-500',
          state === 'done' && cancelled && 'bg-neutral-400',
          state === 'current' && !error && !cancelled && 'bg-brand-600 ring-2 ring-brand-200',
          state === 'current' && error && 'bg-danger-500 ring-2 ring-danger-200',
          state === 'current' && cancelled && 'bg-warning-500 ring-2 ring-warning-200',
          state === 'upcoming' && 'bg-neutral-300',
        );

        // Label colors
        const labelCn = cn(
          labelSize,
          'font-medium mt-1.5 whitespace-nowrap select-none',
          'transition-colors duration-base',
          state === 'done' && !cancelled && 'text-neutral-500',
          state === 'done' && cancelled && 'text-neutral-400',
          state === 'current' && !error && !cancelled && 'text-brand-700',
          state === 'current' && error && 'text-danger-600',
          state === 'current' && cancelled && 'text-warning-700',
          state === 'upcoming' && 'text-neutral-400',
        );

        // Connector line (positioned between dots)
        const lineCn = cn(
          lineH,
          'flex-1 mx-1 mt-[5px] transition-all duration-base',
          size === 'xs' ? 'mt-[4px]' : 'mt-[5px]',
          state === 'done' && !cancelled && 'bg-brand-400',
          state === 'done' && cancelled && 'bg-neutral-300',
          (state === 'current' || state === 'upcoming') && 'bg-neutral-200',
        );

        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            {/* Step: dot + label */}
            <div className="flex flex-col items-center flex-shrink-0">
              <span
                className={dotCn}
                role="img"
                aria-label={
                  state === 'done' ? `${label}: completed`
                  : state === 'current' ? `${label}: current`
                  : `${label}: upcoming`
                }
              />
              <span className={labelCn}>{label}</span>
            </div>
            {/* Connector line — shown between steps (not after last) */}
            {!isLast && <span className={lineCn} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
