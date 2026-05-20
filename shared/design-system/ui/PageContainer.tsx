import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  /** Render as `<main>` (default) or another semantic tag. */
  as?: ElementType;
  /** Constrain to `--content-max-w` (1440px). Default true. */
  bounded?: boolean;
  /** Internal padding tier. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Optional page header rendered above children with consistent spacing. */
  header?: ReactNode;
}

const PADDING = {
  none: 'p-0',
  sm:   'px-3 py-3 sm:px-4 sm:py-4',
  md:   'px-3 py-4 sm:px-4 sm:py-5 lg:px-5',
  lg:   'px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8',
};

/**
 * PageContainer — top-level page wrapper.
 *
 * Standardises horizontal padding and max-width so every page reaches the
 * same horizontal rhythm across both apps. Pages should compose:
 *
 *   <PageContainer header={<PageHeader … />}>
 *     <SectionContainer>...</SectionContainer>
 *   </PageContainer>
 */
export function PageContainer({
  as = 'main',
  bounded = true,
  padding = 'md',
  header,
  className,
  children,
  ...rest
}: PageContainerProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        'w-full',
        bounded && 'max-w-content mx-auto',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {header && <div className="mb-4 sm:mb-6">{header}</div>}
      {children}
    </Tag>
  );
}
