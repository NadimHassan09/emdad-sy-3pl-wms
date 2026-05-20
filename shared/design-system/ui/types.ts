/**
 * Shared types for the WMS design-system primitives.
 *
 * Intentionally kept small — these are the vocabulary every primitive uses
 * for variant / size / tone. Pages should compose primitives rather than
 * recreating these enums.
 */
export type Size = 'sm' | 'md' | 'lg';

/** Visual emphasis tier — used by Button, IconButton, etc. */
export type Variant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';

/** Semantic tone — used by Badge, Banner, status surfaces. */
export type Tone =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

/** Operational status vocabulary (Section B.3 of WMS spec). */
export type OperationalStatus =
  | 'draft'
  | 'confirmed'
  | 'receiving'
  | 'in_progress'
  | 'complete'
  | 'completed'
  | 'shipped'
  | 'cancelled'
  | 'assigned'
  | 'active'
  | 'blocked'
  | 'suspended'
  | 'archived'
  | 'approved'
  | 'pending';
