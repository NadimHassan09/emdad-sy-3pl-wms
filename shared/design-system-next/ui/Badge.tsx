import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import type { OperationalStatus, Tone } from './types';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual emphasis level — `soft` (default) or `solid`. */
  appearance?: 'soft' | 'solid' | 'outline';
  /** Pure semantic tone — neutral / success / warning / danger / info / brand / accent. */
  tone?: Tone;
  /** Operational status (Section B.3) — overrides `tone` when set. */
  status?: OperationalStatus;
  /** Optional leading dot indicator. */
  dot?: boolean;
  /** Compact size — `xs` for inline labels, `sm` for table cells. */
  size?: 'xs' | 'sm';
  /** Optional icon rendered before the label. */
  startIcon?: ReactNode;
}

type StatusToneMap = Record<OperationalStatus, { tone: Tone; emphasis?: 'soft' | 'solid' }>;

/** Canonical operational-status → semantic-tone map (Section B.3). */
const STATUS_TO_TONE: StatusToneMap = {
  draft:        { tone: 'neutral' },
  confirmed:    { tone: 'accent' },
  receiving:    { tone: 'info' },
  in_progress:  { tone: 'warning' },
  complete:     { tone: 'success' },
  completed:    { tone: 'success' },
  shipped:      { tone: 'success' },
  cancelled:    { tone: 'danger' },
  assigned:     { tone: 'brand' },
  active:       { tone: 'info' },
  blocked:      { tone: 'danger' },
  suspended:    { tone: 'neutral' },
  archived:     { tone: 'neutral' },
  approved:     { tone: 'success' },
  pending:      { tone: 'warning' },
};

const SOFT_TONE: Record<Tone, string> = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border',
  brand:   'bg-status-success-bg text-status-success-fg border-status-success-border',
  accent:  'bg-status-info-bg text-status-info-fg border-status-info-border',
  success: 'bg-status-success-bg text-status-success-fg border-status-success-border',
  warning: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
  danger:  'bg-status-danger-bg text-status-danger-fg border-status-danger-border',
  info:    'bg-status-info-bg text-status-info-fg border-status-info-border',
};

const SOLID_TONE: Record<Tone, string> = {
  neutral: 'bg-text-muted text-on-brand border-transparent',
  brand:   'bg-cta text-on-brand border-transparent',
  accent:  'bg-accent-600 text-on-brand border-transparent',
  success: 'bg-success-600 text-on-brand border-transparent',
  warning: 'bg-warning-600 text-on-brand border-transparent',
  danger:  'bg-danger-600 text-on-brand border-transparent',
  info:    'bg-info-600 text-on-brand border-transparent',
};

const OUTLINE_TONE: Record<Tone, string> = {
  neutral: 'bg-transparent text-text-body border-border-strong',
  brand:   'bg-transparent text-text-link border-brand-300 dark:border-brand-500/40',
  accent:  'bg-transparent text-accent-700 dark:text-accent-400 border-accent-300 dark:border-accent-500/40',
  success: 'bg-transparent text-status-success-fg border-status-success-border',
  warning: 'bg-transparent text-status-warning-fg border-status-warning-border',
  danger:  'bg-transparent text-status-danger-fg border-status-danger-border',
  info:    'bg-transparent text-status-info-fg border-status-info-border',
};

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-status-neutral-fg',
  brand:   'bg-status-success-fg',
  accent:  'bg-status-info-fg',
  success: 'bg-status-success-fg',
  warning: 'bg-status-warning-fg',
  danger:  'bg-status-danger-fg',
  info:    'bg-status-info-fg',
};

const SIZE_STYLES = {
  xs: 'h-5 text-2xs px-2 gap-1',
  sm: 'h-6 text-xs px-2.5 gap-1.5',
};

/**
 * Badge — operational status indicator.
 *
 * Usage patterns:
 *   <Badge status="confirmed">Confirmed</Badge>           // canonical workflow status
 *   <Badge tone="warning" dot>Stale</Badge>               // ad-hoc semantic
 *   <Badge tone="brand" appearance="solid">Admin</Badge>  // role badge
 *
 * Always pairs a colour with the text label and (optionally) a dot — colour
 * alone is never the only signal (Section B.7 accessibility rule).
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    appearance = 'soft',
    tone,
    status,
    dot,
    size = 'sm',
    startIcon,
    className,
    children,
    ...rest
  },
  ref,
) {
  const resolvedTone: Tone = status ? STATUS_TO_TONE[status].tone : tone ?? 'neutral';
  const toneStyles =
    appearance === 'solid' ? SOLID_TONE[resolvedTone]
    : appearance === 'outline' ? OUTLINE_TONE[resolvedTone]
    : SOFT_TONE[resolvedTone];

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-medium border whitespace-nowrap',
        'rounded-pill',
        SIZE_STYLES[size],
        toneStyles,
        className,
      )}
      style={{ borderRadius: 'var(--radius-pill)' }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full shrink-0',
            appearance === 'solid' ? 'bg-white/80' : DOT_TONE[resolvedTone],
          )}
        />
      )}
      {startIcon && (
        <span className="shrink-0 inline-flex items-center" aria-hidden="true">
          {startIcon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
});
