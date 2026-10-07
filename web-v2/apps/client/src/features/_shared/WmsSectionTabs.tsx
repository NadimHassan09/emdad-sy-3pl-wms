import { NavLink, useLocation } from 'react-router'
import { cn } from '@emdad/ui'
import { resolveSectionSubNav } from '@/lib/section-sub-nav'

const WMS_FALLBACK = [
  {
    labelKey: 'Inbound',
    labelAr: 'الوارد',
    to: '/inbound-orders',
    match: (p: string) => p.startsWith('/inbound-orders'),
  },
  {
    labelKey: 'Outbound',
    labelAr: 'الصادر',
    to: '/outbound-orders',
    match: (p: string) => p.startsWith('/outbound-orders') && !p.startsWith('/outbound-orders/returns'),
  },
  {
    labelKey: 'Returns',
    labelAr: 'المرتجعات',
    to: '/outbound-orders/returns',
    match: (p: string) => p.startsWith('/outbound-orders/returns'),
  },
] as const

/** Inbound | Outbound | Returns — driven by `section-sub-nav` WMS config. */
export function WmsSectionTabs({ isArabic }: { isArabic: boolean }) {
  const { pathname } = useLocation()
  const section = resolveSectionSubNav(pathname)
  const items =
    section && section.matchSection(pathname)
      ? section.items
      : WMS_FALLBACK.map((item) => ({
          labelKey: item.labelKey,
          labelAr: item.labelAr,
          to: item.to,
          match: item.match,
        }))
  const ariaLabel =
    section && section.matchSection(pathname)
      ? isArabic
        ? section.ariaLabelAr
        : section.ariaLabel
      : isArabic
        ? 'تنقل طلبات المستودع'
        : 'Warehouse orders navigation'

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.match(pathname)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {isArabic ? item.labelAr : item.labelKey}
          </NavLink>
        )
      })}
    </nav>
  )
}
