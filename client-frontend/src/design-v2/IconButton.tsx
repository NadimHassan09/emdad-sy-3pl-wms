import type { ReactElement } from 'react';

import { cx } from './cx';

export function IconButton({
  icon,
  badge,
  onClick,
  active,
  title,
}: {
  icon: string;
  badge?: number | string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all',
        active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <i className={cx('fa-solid', icon)} />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
