import type { HTMLAttributes, ReactElement } from 'react';

import { cx } from './cx';

export interface CardV2Props extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className = '', hover = false, children, ...rest }: CardV2Props): ReactElement {
  return (
    <div
      className={cx(
        'bg-white rounded-xl border border-slate-200/60 shadow-soft',
        hover && 'hover-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
