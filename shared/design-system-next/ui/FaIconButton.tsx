/**
 * FaIconButton — Font Awesome class-string icon button for portal chrome.
 * Prefer IconButton with a ReactNode icon for new Admin surfaces.
 */

import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { cn } from './cn';

export interface FaIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Font Awesome solid icon class without `fa-solid`, e.g. `fa-bell`. */
  icon: string;
  badge?: number | string;
  active?: boolean;
  title?: string;
  'aria-label'?: string;
}

export function FaIconButton({
  icon,
  badge,
  onClick,
  active,
  title,
  className,
  'aria-label': ariaLabel,
  type = 'button',
  ...rest
}: FaIconButtonProps): ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:shadow-focus',
        active
          ? 'bg-brand-50 text-brand-600 dark:bg-white/5 dark:text-brand-400'
          : 'text-text-muted hover:bg-surface-hover hover:text-text-strong',
        className,
      )}
      {...rest}
    >
      <i className={cn('fa-solid', icon)} aria-hidden />
      {badge ? (
        <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface-panel bg-brand-500 px-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
