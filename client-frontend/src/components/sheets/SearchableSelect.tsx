import { useEffect, useRef, useState } from 'react';

export type SelectOption = { value: string; label: string };

interface Props {
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}

export function SearchableSelect({ value, options, disabled, placeholder = '—', searchPlaceholder = 'Search…', onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (value || placeholder);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setQ(''); } }}
        className="w-full min-w-[7rem] truncate bg-transparent px-2 py-1.5 text-left text-sm outline-none focus:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:bg-emerald-950/30"
      >
        {display}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[13rem] rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 p-1.5 dark:border-neutral-700">
            <input
              ref={inputRef}
              className="w-full rounded px-2 py-1 text-sm outline-none ring-1 ring-emerald-400"
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => { onChange(''); setOpen(false); setQ(''); }}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-400">No results</div>
            ) : filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  o.value === value ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : ''
                }`}
                onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
