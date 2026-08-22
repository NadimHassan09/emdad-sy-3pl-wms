/**
 * StatusBadge — free-string operational status pill (statusMeta-driven).
 * Prefer this for OMS / Client list status columns; use Badge for tone-based labels.
 */

import type { ReactElement, ReactNode } from 'react';
import { cn } from './cn';
import { normalizeStatusKey, statusLabel, statusMeta } from '../lib/statusMeta';

export interface StatusBadgeProps {
  status: string;
  children?: ReactNode;
  /** Force Arabic labels when true; otherwise reads document dir / storage. */
  isArabic?: boolean;
  className?: string;
}

function detectArabic(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.dir === 'rtl' ||
    window.localStorage.getItem('wms-ui-language') === 'AR' ||
    window.localStorage.getItem('client-ui-language') === 'AR'
  );
}

export function StatusBadge({
  status,
  children,
  isArabic,
  className,
}: StatusBadgeProps): ReactElement {
  const arabic = isArabic ?? detectArabic();
  const key = normalizeStatusKey(status);
  const meta = statusMeta[key] ?? statusMeta.draft;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        meta.bg,
        meta.text,
        meta.border,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
      {children ?? statusLabel(status, arabic)}
    </span>
  );
}
