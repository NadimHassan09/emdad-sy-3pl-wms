import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

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
  /** Render dropdown in normal flow so parent containers can grow/shrink with it. */
  dropdownInFlow?: boolean;
  /** Show the × control to clear the current selection. */
  clearable?: boolean;
  /**
   * Allow values that are not in `options` (type freely; dropdown is optional help).
   * Commits the typed text on each change, blur, and Enter when no list item is chosen.
   */
  allowCustomValue?: boolean;
}

const VIEWPORT_PAD = 8;
const MENU_MAX_H = 240;

function OptionsList({
  filtered,
  value,
  activeIdx,
  emptyMessage,
  onPick,
  setActiveIdx,
  listRef,
  style,
  className,
}: {
  filtered: ComboboxOption[];
  value: string;
  activeIdx: number;
  emptyMessage: string;
  onPick: (v: string) => void;
  setActiveIdx: (i: number) => void;
  listRef?: React.Ref<HTMLUListElement>;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <ul
      ref={listRef}
      className={
        className ??
        'max-h-60 overflow-auto rounded-md border border-border bg-surface-panel py-1 text-sm shadow-lg'
      }
      role="listbox"
      style={style}
    >
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-text-muted">{emptyMessage}</li>
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
                onPick(o.value);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`cursor-pointer px-3 py-1.5 ${
                isActive
                  ? 'bg-brand-50 text-brand-800 dark:bg-white/5 dark:text-brand-400'
                  : 'text-text-body'
              } ${isSelected ? 'font-semibold' : ''}`}
            >
              <div>{o.label}</div>
              {o.hint ? <div className="text-xs text-text-muted">{o.hint}</div> : null}
            </li>
          );
        })
      )}
    </ul>
  );
}

/**
 * Lightweight searchable single-select. No external deps.
 *  - Type to filter (case-insensitive substring against label and hint).
 *  - ↑/↓ to navigate, Enter to select, Esc to close.
 *  - Click outside closes the popup.
 *  - Overlay mode portals the list to `document.body` so overflow:hidden parents cannot clip it.
 *  - `allowCustomValue`: keep typed text even when it is not in the options list.
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
  dropdownInFlow = false,
  clearable = true,
  allowCustomValue = false,
}: ComboboxProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = value ? options.find((o) => o.value === value) : undefined;
  const closedDisplay = selected?.label ?? (allowCustomValue ? value : '') ?? '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === selected.label.toLowerCase())) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query, selected]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    onSearchQueryChange?.('');
  };

  const commitCustom = (raw: string) => {
    if (!allowCustomValue) return;
    const next = raw.trim();
    if (next !== value) onChange(next);
  };

  useLayoutEffect(() => {
    if (!open || dropdownInFlow) {
      setCoords(null);
      return;
    }
    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      // Prefer opening below the field; only flip up when below is unusable
      // and there is clearly more room above (avoids covering fields above the input).
      const openUp = spaceBelow < 96 && spaceAbove > spaceBelow + 40;
      const maxHeight = Math.min(
        MENU_MAX_H,
        Math.max(openUp ? 120 : 96, openUp ? spaceAbove : spaceBelow),
      );
      const top = openUp
        ? Math.max(VIEWPORT_PAD, rect.top - maxHeight - 4)
        : rect.bottom + 4;
      setCoords({
        top,
        left: Math.max(
          VIEWPORT_PAD,
          Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_PAD),
        ),
        width: rect.width,
        maxHeight,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, dropdownInFlow, filtered.length, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      if (allowCustomValue) commitCustom(query);
      setOpen(false);
      if (allowCustomValue) {
        setQuery('');
        onSearchQueryChange?.('');
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit uses latest query/value via closure when open
  }, [open, allowCustomValue, query, value]);

  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [query, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = query.trim();
      if (allowCustomValue) {
        const exact = filtered.find(
          (o) => o.value === q || o.label.toLowerCase() === q.toLowerCase(),
        );
        if (exact) {
          pick(exact.value);
        } else if (q) {
          commitCustom(q);
          setOpen(false);
          setQuery('');
          onSearchQueryChange?.('');
        } else if (filtered[activeIdx]) {
          pick(filtered[activeIdx].value);
        }
      } else {
        const opt = filtered[activeIdx];
        if (opt) pick(opt.value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      onSearchQueryChange?.('');
    }
  };

  const display = open ? query : closedDisplay;

  const portalList =
    !dropdownInFlow &&
    open &&
    coords &&
    typeof document !== 'undefined'
      ? createPortal(
          <OptionsList
            listRef={listRef}
            filtered={filtered}
            value={value}
            activeIdx={activeIdx}
            emptyMessage={emptyMessage}
            onPick={pick}
            setActiveIdx={setActiveIdx}
            className="overflow-auto rounded-md border border-border bg-surface-panel py-1 text-sm shadow-2xl"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: 99999,
            }}
          />,
          document.body,
        )
      : null;

  return (
    <label htmlFor={inputId} className={`block min-w-0 ${className}`}>
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
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          placeholder={closedDisplay ? '' : placeholder}
          value={display}
          onClick={() => {
            if (!disabled && !open) {
              setQuery(closedDisplay);
              setOpen(true);
            }
          }}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onSearchQueryChange?.(v);
            setOpen(true);
            if (allowCustomValue) onChange(v);
          }}
          onFocus={(e) => {
            setQuery(closedDisplay);
            setOpen(true);
            e.currentTarget.select();
          }}
          onKeyDown={handleKeyDown}
          className={`${FILTER_FIELD_CONTROL_CLASS} ${
            clearable && value && !disabled ? 'pe-14' : 'pe-8'
          } ${error ? FILTER_FIELD_CONTROL_ERROR_CLASS : ''}`}
        />
        <div className="absolute inset-y-0 end-0 flex items-center pe-2 gap-0.5">
          {clearable && value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
                setQuery('');
                onSearchQueryChange?.('');
                inputRef.current?.focus();
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-text-faint hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-text-strong transition-colors"
              aria-label="Clear selection"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (disabled) return;
              setOpen((prev) => {
                const next = !prev;
                if (next) {
                  setQuery(closedDisplay);
                  inputRef.current?.focus();
                }
                return next;
              });
            }}
            className="flex h-6 w-6 items-center justify-center text-text-muted hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            aria-label={open ? 'Close dropdown' : 'Open dropdown'}
          >
            <i
              className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${
                open ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''
              }`}
            />
          </button>
        </div>
        {dropdownInFlow ? (
          open ? (
            <div className="mt-1">
              <OptionsList
                filtered={filtered}
                value={value}
                activeIdx={activeIdx}
                emptyMessage={emptyMessage}
                onPick={pick}
                setActiveIdx={setActiveIdx}
              />
            </div>
          ) : null
        ) : null}
        {portalList}
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-danger-600 dark:text-status-danger-fg">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
