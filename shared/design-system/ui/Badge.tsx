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
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  brand:   'bg-brand-50 text-brand-700 border-brand-200',
  accent:  'bg-accent-50 text-accent-700 border-accent-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger:  'bg-danger-50 text-danger-700 border-danger-200',
  info:    'bg-info-50 text-info-700 border-info-200',
};

const SOLID_TONE: Record<Tone, string> = {
  neutral: 'bg-neutral-700 text-white border-neutral-700',
  brand:   'bg-brand-600 text-white border-brand-600',
  accent:  'bg-accent-600 text-white border-accent-600',
  success: 'bg-success-600 text-white border-success-600',
  warning: 'bg-warning-600 text-white border-warning-600',
  danger:  'bg-danger-600 text-white border-danger-600',
  info:    'bg-info-600 text-white border-info-600',
};

const OUTLINE_TONE: Record<Tone, string> = {
  neutral: 'bg-white text-neutral-700 border-neutral-300',
  brand:   'bg-white text-brand-700 border-brand-300',
  accent:  'bg-white text-accent-700 border-accent-300',
  success: 'bg-white text-success-700 border-success-200',
  warning: 'bg-white text-warning-700 border-warning-200',
  danger:  'bg-white text-danger-700 border-danger-200',
  info:    'bg-white text-info-700 border-info-200',
};

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-neutral-400',
  brand:   'bg-brand-500',
  accent:  'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
  info:    'bg-info-500',
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
