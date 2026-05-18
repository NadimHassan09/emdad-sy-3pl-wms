import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { Field } from './Field';
import type { Size } from './types';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  size?: Size;
  /** Icon rendered inside the input on the inline-start side. */
  startAdornment?: ReactNode;
  /** Icon / button rendered inside the input on the inline-end side. */
  endAdornment?: ReactNode;
  /** Hide the label visually but expose to AT. */
  hideLabel?: boolean;
  /** Wrapper class for the Field (label + helper + error). */
  fieldClassName?: string;
}

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base', // tablet-friendly
};

/**
 * Input — single-line text input with label/helper/error and optional
 * inline-start/end adornments. Pure CSS, no animations on focus to keep
 * data entry fast.
 *
 * The Field wrapper handles a11y wiring (`aria-describedby`, `aria-invalid`).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    helper,
    error,
    required,
    size = 'md',
    startAdornment,
    endAdornment,
    hideLabel,
    fieldClassName,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <Field
      htmlFor={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={fieldClassName}
    >
      {(slots) => (
        <div
          className={cn(
            'flex items-center bg-white border rounded-lg overflow-hidden',
            'transition-colors duration-fast ease-standard',
            error
              ? 'border-danger-400 focus-within:border-danger-500 focus-within:shadow-focus-danger'
              : 'border-neutral-300 focus-within:border-brand-600 focus-within:shadow-focus',
            disabled && 'bg-neutral-50 opacity-70 cursor-not-allowed',
          )}
          style={{ borderRadius: 'var(--radius-input)' }}
        >
          {startAdornment && (
            <span className="ps-3 pe-1 text-neutral-500 shrink-0 flex items-center" aria-hidden="true">
              {startAdornment}
            </span>
          )}
          <input
            ref={ref}
            id={slots.id}
            aria-describedby={slots['aria-describedby']}
            aria-invalid={slots['aria-invalid']}
            disabled={disabled}
            required={required}
            className={cn(
              'flex-1 min-w-0 bg-transparent border-0 outline-none',
              'placeholder:text-neutral-400 text-neutral-900',
              'ps-3 pe-3',
              startAdornment ? 'ps-1' : null,
              endAdornment ? 'pe-1' : null,
              SIZE_STYLES[size],
              className,
            )}
            {...rest}
          />
          {endAdornment && (
            <span className="pe-3 ps-1 text-neutral-500 shrink-0 flex items-center" aria-hidden="true">
              {endAdornment}
            </span>
          )}
        </div>
      )}
    </Field>
  );
});
