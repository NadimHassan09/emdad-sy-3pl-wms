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
    container: 'border-status-info-border bg-status-info-bg',
    bar:       'bg-status-info-fg',
    icon:      'text-status-info-fg',
    iconBg:    'bg-status-info-bg',
    title:     'text-status-info-fg',
  },
  success: {
    container: 'border-status-success-border bg-status-success-bg',
    bar:       'bg-status-success-fg',
    icon:      'text-status-success-fg',
    iconBg:    'bg-status-success-bg',
    title:     'text-status-success-fg',
  },
  warning: {
    container: 'border-status-warning-border bg-status-warning-bg',
    bar:       'bg-status-warning-fg',
    icon:      'text-status-warning-fg',
    iconBg:    'bg-status-warning-bg',
    title:     'text-status-warning-fg',
  },
  error: {
    container: 'border-status-danger-border bg-status-danger-bg',
    bar:       'bg-status-danger-fg',
    icon:      'text-status-danger-fg',
    iconBg:    'bg-status-danger-bg',
    title:     'text-status-danger-fg',
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
          <div className="text-sm text-text-body">{description}</div>
        )}
        {children && (
          <div className="text-sm text-text-body">{children}</div>
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
            'text-text-muted hover:bg-surface-hover hover:text-text-body',
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
    info:    'text-status-info-fg hover:opacity-80',
    success: 'text-status-success-fg hover:opacity-80',
    warning: 'text-status-warning-fg hover:opacity-80',
    error:   'text-status-danger-fg hover:opacity-80',
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
