import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  endAdornment?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, endAdornment, className = '', id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    const inputClassName = `${FILTER_FIELD_CONTROL_CLASS} ${
      error ? FILTER_FIELD_CONTROL_ERROR_CLASS : ''
    } ${endAdornment ? 'min-w-0 flex-1' : ''} ${className}`;

    return (
      <label htmlFor={inputId} className="block min-w-0">
        {label ? (
          <span className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>{label}</span>
        ) : null}
        {endAdornment ? (
          <div className="flex items-stretch gap-2">
            <input ref={ref} id={inputId} className={inputClassName} {...rest} />
            <div className="shrink-0">{endAdornment}</div>
          </div>
        ) : (
          <input ref={ref} id={inputId} className={inputClassName} {...rest} />
        )}
        {error ? (
          <span className="mt-1 block text-xs text-danger-600 dark:text-status-danger-fg">{error}</span>
        ) : hint ? (
          <span className="mt-1 block text-xs text-text-muted">{hint}</span>
        ) : null}
      </label>
    );
  },
);
TextField.displayName = 'TextField';
