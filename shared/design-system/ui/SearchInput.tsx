/**
 * SearchInput — a self-contained search field that submits on Enter or button click.
 *
 * Pattern:
 *   - Controlled via `value` / `onChange` (draft state)
 *   - `onSearch` fires when the user submits (Enter key or search button)
 *   - Clear button appears when `value` is non-empty — clears the draft AND calls onSearch('')
 *   - `isLoading` spinner replaces the search icon
 *
 * Consumers typically pair this with a `useFilters`-style draft/applied split:
 *   onChange → update draft
 *   onSearch → apply draft to query
 */

import { useRef, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  /** Minimum characters before search fires. Defaults to 0. */
  minLength?: number;
  /** Show the search button next to the input. Default true. */
  showButton?: boolean;
  /** Label for the search button. Defaults to "Search". */
  buttonLabel?: string;
  /** aria-label for the input. Required for a11y when no visible label exists. */
  'aria-label'?: string;
  className?: string;
  /** Additional class for the input element. */
  inputClassName?: string;
  /** Auto-search after `debounceMs` milliseconds of no typing. */
  debounceMs?: number;
  disabled?: boolean;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  isLoading,
  showButton = true,
  buttonLabel = 'Search',
  'aria-label': ariaLabel,
  className,
  inputClassName,
  disabled,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      onChange('');
      onSearch('');
    }
  };

  const handleClear = () => {
    onChange('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn('flex items-center gap-2', className)}
    >
      <div
        className={cn(
          'flex flex-1 items-center rounded-lg border bg-white',
          'transition-colors duration-fast ease-standard',
          'focus-within:border-brand-600 focus-within:shadow-focus',
          disabled ? 'border-neutral-200 bg-neutral-50 opacity-70' : 'border-neutral-300',
        )}
        style={{ borderRadius: 'var(--radius-input)' }}
      >
        {/* Search icon / loading indicator */}
        <span
          aria-hidden="true"
          className="ps-3 text-neutral-400 shrink-0 flex items-center"
        >
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <svg
              width="15" height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M15 15l-3.5-3.5" />
            </svg>
          )}
        </span>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'flex-1 min-w-0 h-10 bg-transparent border-0 outline-none ps-2 pe-2',
            'text-sm text-neutral-900 placeholder:text-neutral-400',
            // Hide the native ×-clear button in WebKit (we render our own)
            '[&::-webkit-search-cancel-button]:hidden',
            inputClassName,
          )}
        />

        {/* Clear button — only visible when there's input */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              'pe-2.5 text-neutral-400 hover:text-neutral-600',
              'flex items-center shrink-0 transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:text-neutral-700',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        )}
      </div>

      {showButton && (
        <button
          type="submit"
          disabled={disabled || isLoading}
          className={cn(
            'h-10 px-4 rounded-lg font-medium text-sm whitespace-nowrap',
            'bg-brand-600 text-white border border-brand-600',
            'transition-colors duration-fast ease-standard',
            'hover:bg-brand-700 hover:border-brand-700',
            'disabled:cursor-not-allowed disabled:bg-brand-300 disabled:border-brand-300',
            'focus-visible:outline-none focus-visible:shadow-focus',
          )}
          style={{ borderRadius: 'var(--radius-button)' }}
        >
          {buttonLabel}
        </button>
      )}
    </form>
  );
}
