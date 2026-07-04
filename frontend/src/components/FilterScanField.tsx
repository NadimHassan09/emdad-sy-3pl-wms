import type { InputHTMLAttributes, ReactNode } from 'react';

import { FilterScanButton } from './FilterScanButton';
import { TextField } from './TextField';

export function FilterScanField({
  label,
  value,
  onChange,
  onScanClick,
  placeholder,
  scanTitle,
  scanAriaLabel,
  inputProps,
  endAdornment,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onScanClick: () => void;
  placeholder?: string;
  scanTitle: string;
  scanAriaLabel: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder'>;
  endAdornment?: ReactNode;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      endAdornment={
        endAdornment ?? (
          <FilterScanButton
            compact
            onClick={onScanClick}
            title={scanTitle}
            ariaLabel={scanAriaLabel}
          />
        )
      }
      {...inputProps}
    />
  );
}
