/**
 * Standard admin list-page chrome matching the Client Portal schema:
 * 1) H1 + icon (top left) + primary actions (top right)
 * 2) Section sub-nav (when the route has sibling tabs)
 * 3) Page body: filters → table (passed as children)
 */

import type { ReactNode } from 'react';

import { ListPageHeader } from '@ds';

import { SectionSubNavCard } from './SectionSubNavCard';
import { useClaimSectionNav } from './section-nav-ownership';

type Props = {
  icon: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  isArabic?: boolean;
  /** When false, skip SectionSubNavCard (page provides its own nav). Default true. */
  showSectionNav?: boolean;
  className?: string;
  children: ReactNode;
};

export function AdminListPageShell({
  icon,
  title,
  subtitle,
  actions,
  isArabic = false,
  showSectionNav = true,
  className = 'space-y-5 animate-enter',
  children,
}: Props) {
  useClaimSectionNav();

  return (
    <div className={className}>
      <ListPageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      {showSectionNav ? <SectionSubNavCard isArabic={isArabic} /> : null}
      {children}
    </div>
  );
}
