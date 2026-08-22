import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: readonly Option[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, options, placeholder, className = '', id, required, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <label htmlFor={selectId} className="block min-w-0">
        {label ? (
          <span className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
            {label}
            {required ? (
              <span aria-hidden="true" className="ms-0.5 text-danger-600">
                *
              </span>
            ) : null}
          </span>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={`${FILTER_FIELD_CONTROL_CLASS} ${
            error ? FILTER_FIELD_CONTROL_ERROR_CLASS : ''
          } ${className}`}
          required={required}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="mt-1 block text-xs text-danger-600 dark:text-status-danger-fg">{error}</span>
        ) : hint ? (
          <span className="mt-1 block text-xs text-text-muted">{hint}</span>
        ) : null}
      </label>
    );
  },
);
SelectField.displayName = 'SelectField';
