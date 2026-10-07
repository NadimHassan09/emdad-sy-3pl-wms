/**
 * Operational status tones — the ONLY place status colours are mapped to classes.
 * Badge, status card, legend dot, row accent and chart legend all use these.
 * Pairs are verified >= 4.5:1 by `npm run check:contrast` (tokens.css).
 */
export type Tone =
  | 'neutral'
  | 'pending'
  | 'progress'
  | 'ready'
  | 'transit'
  | 'success'
  | 'warning'
  | 'danger'
  | 'returned';

export const TONES: readonly Tone[] = [
  'neutral', 'pending', 'progress', 'ready', 'transit', 'success', 'warning', 'danger', 'returned',
] as const;

type ToneClasses = {
  /** soft badge: background + text + border */
  soft: string;
  /** just the dot */
  dot: string;
  /** soft background only (cards) */
  bg: string;
  /** readable text colour on the soft background */
  text: string;
  border: string;
  /** selected-state ring for filter cards */
  ring: string;
};

// NOTE: classes are written out in full so Tailwind can see them statically.
export const toneClasses: Record<Tone, ToneClasses> = {
  neutral: { soft: 'bg-tone-neutral-bg text-tone-neutral-fg border-tone-neutral-border', dot: 'bg-tone-neutral-dot', bg: 'bg-tone-neutral-bg', text: 'text-tone-neutral-fg', border: 'border-tone-neutral-border', ring: 'ring-tone-neutral-dot' },
  pending: { soft: 'bg-tone-pending-bg text-tone-pending-fg border-tone-pending-border', dot: 'bg-tone-pending-dot', bg: 'bg-tone-pending-bg', text: 'text-tone-pending-fg', border: 'border-tone-pending-border', ring: 'ring-tone-pending-dot' },
  progress: { soft: 'bg-tone-progress-bg text-tone-progress-fg border-tone-progress-border', dot: 'bg-tone-progress-dot', bg: 'bg-tone-progress-bg', text: 'text-tone-progress-fg', border: 'border-tone-progress-border', ring: 'ring-tone-progress-dot' },
  ready: { soft: 'bg-tone-ready-bg text-tone-ready-fg border-tone-ready-border', dot: 'bg-tone-ready-dot', bg: 'bg-tone-ready-bg', text: 'text-tone-ready-fg', border: 'border-tone-ready-border', ring: 'ring-tone-ready-dot' },
  transit: { soft: 'bg-tone-transit-bg text-tone-transit-fg border-tone-transit-border', dot: 'bg-tone-transit-dot', bg: 'bg-tone-transit-bg', text: 'text-tone-transit-fg', border: 'border-tone-transit-border', ring: 'ring-tone-transit-dot' },
  success: { soft: 'bg-tone-success-bg text-tone-success-fg border-tone-success-border', dot: 'bg-tone-success-dot', bg: 'bg-tone-success-bg', text: 'text-tone-success-fg', border: 'border-tone-success-border', ring: 'ring-tone-success-dot' },
  warning: { soft: 'bg-tone-warning-bg text-tone-warning-fg border-tone-warning-border', dot: 'bg-tone-warning-dot', bg: 'bg-tone-warning-bg', text: 'text-tone-warning-fg', border: 'border-tone-warning-border', ring: 'ring-tone-warning-dot' },
  danger: { soft: 'bg-tone-danger-bg text-tone-danger-fg border-tone-danger-border', dot: 'bg-tone-danger-dot', bg: 'bg-tone-danger-bg', text: 'text-tone-danger-fg', border: 'border-tone-danger-border', ring: 'ring-tone-danger-dot' },
  returned: { soft: 'bg-tone-returned-bg text-tone-returned-fg border-tone-returned-border', dot: 'bg-tone-returned-dot', bg: 'bg-tone-returned-bg', text: 'text-tone-returned-fg', border: 'border-tone-returned-border', ring: 'ring-tone-returned-dot' },
};
