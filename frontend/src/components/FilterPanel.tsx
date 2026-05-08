import type { ReactNode } from 'react';
import { useState } from 'react';

export function FilterPanel({
  children,
  defaultOpen = false,
  showLabel = 'Show filters',
  hideLabel = 'Hide filters',
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  showLabel?: string;
  hideLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span>{open ? hideLabel : showLabel}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
