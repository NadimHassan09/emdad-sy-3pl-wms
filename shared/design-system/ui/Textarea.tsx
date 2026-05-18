import {
  forwardRef,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { Field } from './Field';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  fieldClassName?: string;
}

/**
 * Textarea — multi-line text input.
 *
 * Notes for operators: `dir="auto"` lets the browser detect language from
 * the first typed character — important for free-text notes that may be
 * either English or Arabic.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      id,
      label,
      helper,
      error,
      required,
      hideLabel,
      fieldClassName,
      className,
      disabled,
      rows = 4,
      dir = 'auto',
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
          <textarea
            ref={ref}
            id={slots.id}
            aria-describedby={slots['aria-describedby']}
            aria-invalid={slots['aria-invalid']}
            disabled={disabled}
            required={required}
            rows={rows}
            dir={dir}
            className={cn(
              'block w-full bg-white border rounded-lg px-3 py-2 text-sm',
              'placeholder:text-neutral-400 text-neutral-900',
              'transition-colors duration-fast ease-standard',
              'focus:outline-none',
              error
                ? 'border-danger-400 focus:border-danger-500 focus:shadow-focus-danger'
                : 'border-neutral-300 focus:border-brand-600 focus:shadow-focus',
              disabled && 'bg-neutral-50 opacity-70 cursor-not-allowed',
              className,
            )}
            style={{ borderRadius: 'var(--radius-input)' }}
            {...rest}
          />
        )}
      </Field>
    );
  },
);
