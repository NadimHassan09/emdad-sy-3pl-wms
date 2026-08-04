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
  listRef?: React.RefObject<HTMLUListElement | null>;
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

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    onSearchQueryChange?.('');
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
      setOpen(false);
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
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) pick(opt.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      onSearchQueryChange?.('');
    }
  };

  const display = open ? query : selected?.label ?? '';

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
            className="z-[80] overflow-auto rounded-md border border-border bg-surface-panel py-1 text-sm shadow-lg"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
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
          className={`${FILTER_FIELD_CONTROL_CLASS} ${
            clearable && value && !disabled ? 'pr-7' : ''
          } ${error ? FILTER_FIELD_CONTROL_ERROR_CLASS : ''}`}
        />
        {clearable && value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              onChange('');
              setQuery('');
              onSearchQueryChange?.('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 end-1 z-10 flex w-6 items-center justify-center text-text-faint hover:text-text-muted"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
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
