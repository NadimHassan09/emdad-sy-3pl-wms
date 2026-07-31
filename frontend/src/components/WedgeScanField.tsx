/**
 * WedgeScanField — keyboard-wedge / gun-first scan input.
 * Enter commits; optional camera button opens an existing modal (secondary path).
 */

import { useEffect, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

import { FilterScanButton } from './FilterScanButton';
import { TextField } from './TextField';

export function WedgeScanField({
  label,
  value,
  onChange,
  onScan,
  placeholder,
  scanTitle,
  scanAriaLabel,
  onCameraClick,
  autoFocus = true,
  disabled,
  inputProps,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with trimmed code when Enter is pressed (or after camera decode). */
  onScan: (code: string) => void;
  placeholder?: string;
  scanTitle?: string;
  scanAriaLabel?: string;
  onCameraClick?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder' | 'onKeyDown'>;
  hint?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const id = window.setTimeout(() => ref.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [autoFocus, disabled]);

  const commit = () => {
    const code = value.trim();
    if (!code || disabled) return;
    onScan(code);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  };

  return (
    <div className="space-y-1">
      <TextField
        ref={ref}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        endAdornment={
          onCameraClick ? (
            <FilterScanButton
              compact
              onClick={onCameraClick}
              title={scanTitle ?? 'Scan with camera'}
              ariaLabel={scanAriaLabel ?? 'Scan with camera'}
            />
          ) : undefined
        }
        {...inputProps}
        onKeyDown={onKeyDown}
      />
      {hint ? <p className="text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}
