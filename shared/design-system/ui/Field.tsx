import { useId, type ReactNode } from 'react';
import { cn } from './cn';

interface FieldProps {
  /** Visible label rendered above the control. */
  label?: ReactNode;
  /** Helper text rendered below the control when no error is present. */
  helper?: ReactNode;
  /** Error message — when present, overrides helper and sets `aria-invalid`. */
  error?: ReactNode;
  /** Mark the field as required visually + via the wrapped control. */
  required?: boolean;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
  /** Optional id to share with the wrapped control. Auto-generated otherwise. */
  htmlFor?: string;
  className?: string;
  /**
   * Renders the actual control. Receives `id`, `aria-describedby`, and
   * `aria-invalid` so the underlying element wires up correctly.
   */
  children: (slots: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => ReactNode;
}

/**
 * Field — accessibility-first label/helper/error wrapper.
 *
 * Used by Input, Textarea, and Select primitives. Also exported directly so
 * custom controls (combobox, date picker) can adopt the same a11y wiring.
 */
export function Field({
  label,
  helper,
  error,
  required,
  hideLabel,
  htmlFor,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label !== undefined && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-neutral-700',
            hideLabel && 'sr-only',
          )}
        >
          {label}
          {required && (
            <span
              aria-hidden="true"
              className="text-danger-600 ms-1"
            >
              *
            </span>
          )}
        </label>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {error ? (
        <p
          id={errorId}
          className="text-xs font-medium text-danger-700"
          role="alert"
        >
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-xs text-neutral-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
