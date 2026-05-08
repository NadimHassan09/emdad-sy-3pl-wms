import { SelectHTMLAttributes, forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, options, placeholder, className = '', id, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <label htmlFor={selectId} className="block">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <select
          ref={ref}
          id={selectId}
          className={`mt-1 block w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
              : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
          } ${className}`}
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
          <span className="mt-1 block text-xs text-rose-600">{error}</span>
        ) : hint ? (
          <span className="mt-1 block text-xs text-slate-500">{hint}</span>
        ) : null}
      </label>
    );
  },
);
SelectField.displayName = 'SelectField';
