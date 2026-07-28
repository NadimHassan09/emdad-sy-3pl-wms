import type { ReactElement, ReactNode } from 'react';

import { cx } from './cx';

export interface PillTabItem {
  id: string;
  label: string;
  badge?: ReactNode;
}

export function PillTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: PillTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <div className="flex gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={cx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
            activeId === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}
