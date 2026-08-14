/**
 * Standard admin list-page chrome matching the Client Portal schema:
 * 1) H1 + icon (top left) + optional primary actions (top right)
 * 2) Section sub-nav (when the route has sibling tabs) + optional nav-row actions
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
  /** Actions next to the page title (top right). */
  actions?: ReactNode;
  /**
   * Actions aligned with the section sub-nav row (e.g. + New inbound).
   * Prefer this over `actions` when the page has Inbound/Outbound tabs.
   */
  navActions?: ReactNode;
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
  navActions,
  isArabic = false,
  showSectionNav = true,
  className = 'mx-auto w-full max-w-7xl space-y-5 animate-enter',
  children,
}: Props) {
  useClaimSectionNav();

  return (
    <div className={className}>
      <ListPageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      {showSectionNav ? (
        <SectionSubNavCard isArabic={isArabic} actions={navActions} />
      ) : navActions ? (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">{navActions}</div>
      ) : null}
      {children}
    </div>
  );
}
