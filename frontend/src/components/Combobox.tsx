import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary line shown below the primary label in the dropdown. */
  hint?: string;
}

interface ComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Fires while the user types in the search box — use with debounced server fetch. */
  onSearchQueryChange?: (query: string) => void;
}

/**
 * Lightweight searchable single-select. No external deps.
 *  - Type to filter (case-insensitive substring against label and hint).
 *  - ↑/↓ to navigate, Enter to select, Esc to close.
 *  - Click outside closes the popup.
 */
export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  hint,
  error,
  disabled,
  required,
  emptyMessage = 'No matches',
  className = '',
  onSearchQueryChange,
}: ComboboxProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [query, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        setQuery('');
        onSearchQueryChange?.('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      onSearchQueryChange?.('');
    }
  };

  const display = open ? query : selected?.label ?? '';

  return (
    <label htmlFor={inputId} className={`block ${className}`}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <div ref={wrapperRef} className="relative mt-1">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          placeholder={selected ? '' : placeholder}
          value={display}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onSearchQueryChange?.(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={`block w-full rounded-md border px-3 py-1.5 pr-7 text-sm shadow-sm focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-200'
          } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'bg-white'}`}
        />
        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              onChange('');
              setQuery('');
              onSearchQueryChange?.('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-1 flex w-6 items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
        {open && (
          <ul
            className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-500">{emptyMessage}</li>
            ) : (
              filtered.map((o, idx) => {
                const isActive = idx === activeIdx;
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(o.value);
                      setOpen(false);
                      setQuery('');
                      onSearchQueryChange?.('');
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`cursor-pointer px-3 py-1.5 ${
                      isActive ? 'bg-primary-50 text-primary-800' : 'text-slate-800'
                    } ${isSelected ? 'font-semibold' : ''}`}
                  >
                    <div>{o.label}</div>
                    {o.hint && (
                      <div className="text-xs text-slate-500">{o.hint}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}
