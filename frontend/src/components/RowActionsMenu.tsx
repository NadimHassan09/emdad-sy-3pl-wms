import { useEffect, useId, useState, type ReactNode } from 'react';

import { AnchoredDropdown } from './AnchoredDropdown';

export interface RowAction {
  key: string;
  label: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * A compact "⋯" (three-dots) button that toggles a dropdown of row actions.
 * Each instance owns its open state and closes on outside click. Renders
 * nothing when there are no available actions.
 */
export function RowActionsMenu({
  items,
  ariaLabel = 'Open actions',
}: {
  items: RowAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const tag = `row-actions-${useId()}`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (target?.closest(`[data-row-actions="${tag}"]`)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, tag]);

  if (items.length === 0) return null;

  return (
    <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <AnchoredDropdown
        open={open}
        align="end"
        menuRootProps={{ 'data-row-actions': tag }}
        trigger={
          <button
            type="button"
            data-row-actions={tag}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
            onClick={() => setOpen((o) => !o)}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
            </svg>
          </button>
        }
      >
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            data-row-actions={tag}
            disabled={it.disabled}
            className={`block w-full px-3 py-2 text-start text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              it.danger ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => {
              setOpen(false);
              it.onClick();
            }}
          >
            {it.label}
          </button>
        ))}
      </AnchoredDropdown>
    </div>
  );
}
