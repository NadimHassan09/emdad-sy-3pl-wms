import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@ui/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { SiteHeader, type SiteHeaderProps } from './site-header'
import type { NavGroup, ShellLabels } from './nav-types'

export type AppShellProps = Omit<SiteHeaderProps, 'groups' | 'labels'> & {
  groups: NavGroup[]
  labels: ShellLabels
  dir: 'ltr' | 'rtl'
  sidebarFooter?: ReactNode
  /** Banner rendered above the header (billing restriction etc.) */
  topBanner?: ReactNode
  children: ReactNode
}

/**
 * Emdad application shell: dark-green gradient sidebar (side follows `dir`),
 * mint canvas, light content sheet. Mobile: sidebar becomes an off-canvas sheet.
 */
export function AppShell({ groups, labels, dir, sidebarFooter, topBanner, children, ...header }: AppShellProps) {
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {labels.skipToContent}
      </a>
      <AppSidebar groups={groups} side={dir === 'rtl' ? 'right' : 'left'} portalLabel={labels.portal} footer={sidebarFooter} />
      <SidebarInset className="min-w-0 bg-background lg:peer-data-[collapsible=icon]:[&_[data-slot=site-header]]:pe-6">
        {topBanner}
        <SiteHeader groups={groups} labels={labels} {...header} />
        <main id="main" className="min-w-0 flex-1 px-3 pb-6 sm:px-5">
          <div className="min-h-[calc(100svh-6rem)] rounded-2xl bg-sheet p-3 sm:p-5">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
