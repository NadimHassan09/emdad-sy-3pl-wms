/** @deprecated Import Card from `@ds`. Thin bridge for leftover design-v2 imports. */
import type { HTMLAttributes, ReactElement } from 'react';
import { Card as DsCard, cn } from '@ds';

export interface CardV2Props extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className = '', hover = false, children, ...rest }: CardV2Props): ReactElement {
  return (
    <DsCard
      padding="none"
      elevation="raised"
      interactive={hover}
      className={cn('rounded-xl', className)}
      {...rest}
    >
      {children}
    </DsCard>
  );
}
