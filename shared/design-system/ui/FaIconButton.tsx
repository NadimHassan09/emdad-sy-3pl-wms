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
          ? 'bg-emerald-50 text-emerald-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        className,
      )}
      {...rest}
    >
      <i className={cn('fa-solid', icon)} aria-hidden />
      {badge ? (
        <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
