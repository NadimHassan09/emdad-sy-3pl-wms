import { useId, useState, type InputHTMLAttributes } from 'react';

import {
  filterRecipientNameInput,
  isValidRecipientName,
  normalizeRecipientName,
  recipientNameErrorMessage,
} from '../../lib/recipient-contact';
import { cn } from './cn';
import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

export type RecipientNameInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  isArabic?: boolean;
  submitted?: boolean;
};

export function RecipientNameInput({
  label,
  value,
  onChange,
  isArabic = false,
  submitted = false,
  className = '',
  id,
  required,
  disabled,
  ...rest
}: RecipientNameInputProps) {
  const inputId = id ?? useId();
  const [touched, setTouched] = useState(false);
  const normalized = normalizeRecipientName(value);
  const emptyRequired = Boolean(required) && !normalized;
  const invalidFormat = Boolean(normalized) && !isValidRecipientName(value);
  const showError = (touched || submitted) && (emptyRequired || invalidFormat);
  const error = showError
    ? emptyRequired
      ? isArabic
        ? 'اسم المستلم مطلوب.'
        : 'Recipient name is required.'
      : recipientNameErrorMessage(isArabic)
    : null;

  return (
    <label htmlFor={inputId} className="block min-w-0">
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
      <input
        {...rest}
        id={inputId}
        type="text"
        autoComplete="name"
        disabled={disabled}
        required={required}
        value={value}
        aria-invalid={showError || undefined}
        onChange={(e) => onChange(filterRecipientNameInput(e.target.value))}
        onBlur={() => {
          setTouched(true);
          onChange(normalizeRecipientName(value));
        }}
        className={cn(
          FILTER_FIELD_CONTROL_CLASS,
          showError ? FILTER_FIELD_CONTROL_ERROR_CLASS : '',
          className,
        )}
      />
      {error ? (
        <span className="mt-1 block text-xs text-danger-600 dark:text-status-danger-fg">{error}</span>
      ) : null}
    </label>
  );
}
