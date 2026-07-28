import type { ReactElement, ReactNode } from 'react';

import { cx } from './cx';
import { statusMeta, statusLabel } from './statusMeta';

export function Badge({
  status,
  children,
}: {
  status: string;
  children?: ReactNode;
}): ReactElement {
  const key = status.replace(/_/g, ' ').trim().toLowerCase();
  const s = statusMeta[key] ?? statusMeta.draft;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        s.bg,
        s.text,
        s.border,
      )}
    >
      <span className={cx('w-1.5 h-1.5 rounded-full', s.dot)} />
      {children ?? statusLabel(status)}
    </span>
  );
}
