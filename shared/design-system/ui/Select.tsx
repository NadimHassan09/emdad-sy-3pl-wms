import {
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { Field } from './Field';
import type { Size } from './types';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  fieldClassName?: string;
  size?: Size;
  /** Convenience: render options from a flat array. */
  options?: SelectOption[];
  /** Placeholder shown as the first disabled option (when uncontrolled). */
  placeholder?: string;
}

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
};

/**
 * Select — native `<select>` styled to match the design system.
 *
 * Native select is intentional: it gives operators the correct mobile
 * keyboard / scroll wheel on tablets and screen readers announce options
 * out of the box. For searchable variants we'll add a Combobox in Phase 2.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    helper,
    error,
    required,
    hideLabel,
    fieldClassName,
    size = 'md',
    options,
    placeholder,
    className,
    disabled,
    children,
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
        <select
          ref={ref}
          id={slots.id}
          aria-describedby={slots['aria-describedby']}
          aria-invalid={slots['aria-invalid']}
          disabled={disabled}
          required={required}
          className={cn(
            'block w-full bg-white border rounded-lg ps-3 pe-9 text-neutral-900',
            'transition-colors duration-fast ease-standard',
            'appearance-none',
            'bg-no-repeat bg-[length:1rem_1rem]',
            // chevron — uses currentColor neutral-500
            "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/></svg>\")]",
            'bg-[position:right_0.75rem_center] rtl:bg-[position:left_0.75rem_center]',
            'focus:outline-none',
            error
              ? 'border-danger-400 focus:border-danger-500 focus:shadow-focus-danger'
              : 'border-neutral-300 focus:border-brand-600 focus:shadow-focus',
            disabled && 'bg-neutral-50 opacity-70 cursor-not-allowed',
            SIZE_STYLES[size],
            className,
          )}
          style={{ borderRadius: 'var(--radius-input)' }}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
      )}
    </Field>
  );
});
