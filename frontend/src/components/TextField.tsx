import { InputHTMLAttributes, forwardRef } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <label htmlFor={inputId} className="block">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`mt-1 block w-full rounded-md border px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
              : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
          } ${className}`}
          {...rest}
        />
        {error ? (
          <span className="mt-1 block text-xs text-rose-600">{error}</span>
        ) : hint ? (
          <span className="mt-1 block text-xs text-slate-500">{hint}</span>
        ) : null}
      </label>
    );
  },
);
TextField.displayName = 'TextField';
