/**
 * Alert — operational alert/banner component.
 *
 * Used for:
 *   - Network / loading errors (variant="error")
 *   - Capacity warnings (variant="warning")
 *   - Informational context (variant="info")
 *   - Successful confirmations (variant="success")
 *
 * Design rules:
 *   - Always shows an icon + title for screen-reader clarity (role="alert")
 *   - Dismiss button is optional (controlled by `onDismiss`)
 *   - Action button is optional (e.g., "Retry", "View details")
 *   - Developer / raw error strings MUST NOT be passed directly — wrap in a
 *     human-readable message before rendering
 *   - Compact variant (compact=true) removes left decoration and icon for
 *     tight inline contexts (form validation, inline banners)
 *
 * RTL: logical properties throughout.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  /** Alert heading — bold, short, operational (e.g. "Could not load orders"). */
  title?: ReactNode;
  /** Longer explanation — optional. */
  description?: ReactNode;
  /** Custom icon — defaults to the variant icon. */
  icon?: ReactNode;
  /** Dismiss callback — shows ×-close button when provided. */
  onDismiss?: () => void;
  /** Primary action button (e.g. "Retry", "View all"). */
  action?: ReactNode;
  /** Compact mode — no colored bar, tighter padding. */
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<AlertVariant, {
  container: string;
  bar: string;
  icon: string;
  iconBg: string;
  title: string;
}> = {
  info: {
    container: 'border-info-200 bg-info-50',
    bar:       'bg-info-400',
    icon:      'text-info-600',
    iconBg:    'bg-info-100',
    title:     'text-info-800',
  },
  success: {
    container: 'border-success-200 bg-success-50',
    bar:       'bg-success-500',
    icon:      'text-success-600',
    iconBg:    'bg-success-100',
    title:     'text-success-800',
  },
  warning: {
    container: 'border-warning-200 bg-warning-50',
    bar:       'bg-warning-400',
    icon:      'text-warning-600',
    iconBg:    'bg-warning-100',
    title:     'text-warning-800',
  },
  error: {
    container: 'border-danger-200 bg-danger-50',
    bar:       'bg-danger-500',
    icon:      'text-danger-600',
    iconBg:    'bg-danger-100',
    title:     'text-danger-800',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Default icons per variant
// ─────────────────────────────────────────────────────────────────────────────

function DefaultIcon({ variant }: { variant: AlertVariant }) {
  if (variant === 'success') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M5 10l4 4 6-8" />
        <circle cx="10" cy="10" r="8" />
      </svg>
    );
  }
  if (variant === 'warning') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M10 7v4M10 13.5v.5" />
        <path d="M9 3l-7 13h16L11 3a1.2 1.2 0 0 0-2 0Z" />
      </svg>
    );
  }
  if (variant === 'error') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v5M10 13.5v.5" />
      </svg>
    );
  }
  // info
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 7v.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Alert({
  variant = 'info',
  title,
  description,
  icon,
  onDismiss,
  action,
  compact,
  className,
  children,
  ...rest
}: AlertProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role="alert"
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-lg border',
        compact ? 'px-3.5 py-2.5' : 'ps-4 pe-4 py-3.5',
        styles.container,
        className,
      )}
      style={{ borderRadius: 'var(--radius-lg)' }}
      {...rest}
    >
      {/* Left color bar */}
      {!compact && (
        <span
          className={cn(
            'absolute inset-y-0 start-0 w-1 rounded-ss-lg rounded-es-lg',
            styles.bar,
          )}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      {!compact && (
        <span
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            styles.iconBg,
            styles.icon,
          )}
          aria-hidden="true"
        >
          {icon ?? <DefaultIcon variant={variant} />}
        </span>
      )}

      {/* Content */}
      <div className={cn('flex flex-1 flex-col gap-0.5 min-w-0', !compact && 'ps-1')}>
        {title && (
          <p className={cn('text-sm font-semibold', styles.title)}>{title}</p>
        )}
        {description && (
          <div className="text-sm text-neutral-700">{description}</div>
        )}
        {children && (
          <div className="text-sm text-neutral-700">{children}</div>
        )}
        {action && (
          <div className="mt-1.5">{action}</div>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'ms-auto mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            'text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-700',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:shadow-focus',
          )}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert.Action — inline action button within an alert
// ─────────────────────────────────────────────────────────────────────────────

interface AlertActionProps {
  onClick?: () => void;
  children: ReactNode;
  variant?: AlertVariant;
}

Alert.Action = function AlertAction({ onClick, children, variant = 'info' }: AlertActionProps) {
  const colorMap: Record<AlertVariant, string> = {
    info:    'text-info-700 hover:text-info-800',
    success: 'text-success-700 hover:text-success-800',
    warning: 'text-warning-700 hover:text-warning-800',
    error:   'text-danger-700 hover:text-danger-800',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-sm font-semibold underline-offset-2 hover:underline',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:shadow-focus rounded-sm',
        colorMap[variant],
      )}
    >
      {children}
    </button>
  );
};
