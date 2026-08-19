import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import {
  countryDisplayName,
  countryFlagEmoji,
  evaluateRecipientPhone,
  ingestPastedPhone,
  listCountryDialOptions,
  recipientPhoneErrorMessage,
  recipientPhoneSuccessMessage,
  type CountryDialOption,
  type PhoneEvalState,
} from '../../lib/recipient-contact';
import { cn } from './cn';
import {
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

const MENU_MAX_H = 280;
const VIEWPORT_PAD = 8;

export type InternationalPhoneValue = {
  countryIso: string;
  nationalNumber: string;
  e164: string | null;
  state: PhoneEvalState;
  isValid: boolean;
  isEmpty: boolean;
};

export type InternationalPhoneInputProps = {
  label?: string;
  value: InternationalPhoneValue;
  onChange: (next: InternationalPhoneValue) => void;
  disabled?: boolean;
  required?: boolean;
  isArabic?: boolean;
  /** Show valid/invalid messages even before blur (e.g. after submit). */
  submitted?: boolean;
  className?: string;
  id?: string;
};

function toValue(
  countryIso: string,
  nationalNumber: string,
): InternationalPhoneValue {
  const evaluated = evaluateRecipientPhone(countryIso, nationalNumber);
  return {
    countryIso: evaluated.countryIso || countryIso,
    nationalNumber: evaluated.nationalNumber || nationalNumber,
    e164: evaluated.e164,
    state: evaluated.state,
    isValid: evaluated.isValid,
    isEmpty: evaluated.isEmpty,
  };
}

export function createInternationalPhoneValue(
  countryIso: string,
  nationalNumber = '',
): InternationalPhoneValue {
  return toValue(countryIso, nationalNumber);
}

export function InternationalPhoneInput({
  label,
  value,
  onChange,
  disabled,
  required,
  isArabic = false,
  submitted = false,
  className = '',
  id,
}: InternationalPhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const locale = isArabic ? 'ar' : 'en';
  const countries = useMemo(() => listCountryDialOptions(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [touched, setTouched] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const telRef = useRef<HTMLInputElement>(null);

  const selected = countries.find((c) => c.iso === value.countryIso) ?? null;
  const countryName = selected?.name || countryDisplayName(value.countryIso, locale);
  const showValidity = touched || submitted;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.searchText.includes(q));
  }, [countries, query]);

  const helper = showValidity
    ? value.isEmpty
      ? null
      : value.isValid
        ? recipientPhoneSuccessMessage(isArabic)
        : value.state === 'typing'
          ? null
          : recipientPhoneErrorMessage(countryName, isArabic)
    : value.isValid
      ? recipientPhoneSuccessMessage(isArabic)
      : null;

  const showError = Boolean(helper && !value.isValid && value.state !== 'typing' && !value.isEmpty);
  const showSuccess = Boolean(helper && value.isValid);

  const pickCountry = (iso: string) => {
    setOpen(false);
    setQuery('');
    onChange(toValue(iso, value.nationalNumber));
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const openUp = spaceBelow < 120 && spaceAbove > spaceBelow + 40;
      const maxHeight = Math.min(
        MENU_MAX_H,
        Math.max(openUp ? 140 : 120, openUp ? spaceAbove : spaceBelow),
      );
      setCoords({
        top: openUp
          ? Math.max(VIEWPORT_PAD, rect.top - maxHeight - 4)
          : rect.bottom + 4,
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
  }, [open, filtered.length, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [open, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const onNationalChange = (raw: string) => {
    onChange(toValue(value.countryIso, raw));
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const ingested = ingestPastedPhone(text, value.countryIso);
    setTouched(true);
    onChange(toValue(ingested.countryIso, ingested.nationalNumber));
  };

  const onTelKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && !open) {
      setOpen(true);
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) pickCountry(opt.iso);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const menu =
    open && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={listRef}
            className="z-[80] overflow-hidden rounded-lg border border-border bg-surface-panel text-sm shadow-lg"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
          >
            <div className="border-b border-border p-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={isArabic ? 'ابحث عن دولة…' : 'Search country…'}
                className="input-premium h-8 w-full rounded-md border border-border-strong bg-surface-sunken px-3 text-sm text-text-strong placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                aria-label={isArabic ? 'بحث عن دولة' : 'Search country'}
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-auto py-1" aria-label={isArabic ? 'الدول' : 'Countries'}>
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-text-muted">
                  {isArabic ? 'لا توجد نتائج' : 'No matches'}
                </li>
              ) : (
                filtered.map((c: CountryDialOption, idx) => {
                  const isActive = idx === activeIdx;
                  const isSelected = c.iso === value.countryIso;
                  return (
                    <li
                      key={c.iso}
                      role="option"
                      aria-selected={isSelected}
                      data-active={isActive ? 'true' : 'false'}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickCountry(c.iso);
                      }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-1.5',
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-white/5 dark:text-brand-400'
                          : 'text-text-body',
                        isSelected ? 'font-semibold' : '',
                      )}
                    >
                      <span className="w-6 shrink-0 text-base leading-none" aria-hidden>
                        {c.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">+{c.callingCode}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn('block min-w-0', className)}>
      {label ? (
        <label htmlFor={inputId} className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ms-0.5 text-danger-600">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div
        ref={rootRef}
        className={cn(
          'flex h-8 w-full overflow-hidden rounded-lg border bg-surface-sunken',
          'focus-within:outline-none focus-within:ring-2',
          showError
            ? `${FILTER_FIELD_CONTROL_ERROR_CLASS} focus-within:ring-danger-500/20`
            : 'border-border-strong focus-within:border-brand-500 focus-within:ring-brand-500/20',
          disabled ? 'cursor-not-allowed opacity-70' : '',
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={isArabic ? 'اختر الدولة' : 'Select country'}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
          className={cn(
            'flex w-[30%] min-w-[7.5rem] max-w-[11rem] shrink-0 items-center gap-1.5 border-e border-border-strong px-2 text-left text-sm text-text-strong',
            'hover:bg-surface-panel disabled:cursor-not-allowed',
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {selected?.flag ?? countryFlagEmoji(value.countryIso) ?? '🏳️'}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">
            +{selected?.callingCode || value.countryIso || '—'}
          </span>
          <i className="fa-solid fa-chevron-down text-[10px] text-text-muted" aria-hidden />
        </button>
        <input
          ref={telRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          required={required}
          value={value.nationalNumber}
          placeholder={isArabic ? 'رقم الهاتف' : 'Phone number'}
          aria-invalid={showError || undefined}
          onChange={(e) => onNationalChange(e.target.value)}
          onPaste={onPaste}
          onBlur={() => setTouched(true)}
          onKeyDown={onTelKeyDown}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text-strong outline-none placeholder:text-text-faint disabled:cursor-not-allowed"
        />
      </div>
      {showError ? (
        <span className="mt-1 block text-xs text-danger-600 dark:text-status-danger-fg">{helper}</span>
      ) : showSuccess ? (
        <span className="mt-1 block text-xs text-emerald-700 dark:text-status-success-fg">
          ✓ {helper}
        </span>
      ) : null}
      {menu}
    </div>
  );
}
