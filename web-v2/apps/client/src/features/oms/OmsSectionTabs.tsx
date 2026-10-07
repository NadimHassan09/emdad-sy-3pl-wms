import { NavLink, useLocation } from 'react-router'
import { cn } from '@emdad/ui'
import { resolveSectionSubNav } from '@/lib/section-sub-nav'

/** Online orders | COD | Returns — driven by `section-sub-nav` OMS config. */
export function OmsSectionTabs({ isArabic }: { isArabic: boolean }) {
  const { pathname } = useLocation()
  const section = resolveSectionSubNav(pathname)
  if (!section || !section.matchSection(pathname)) {
    // Fall back to OMS links when used on create/detail (section match excludes detail paths).
    const items = [
      {
        labelKey: 'Online orders',
        labelAr: 'الطلبات الإلكترونية',
        to: '/ecommerce-orders',
        match: (p: string) =>
          p.startsWith('/ecommerce-orders') && !p.startsWith('/ecommerce-orders/returns'),
      },
      {
        labelKey: 'Cash on delivery',
        labelAr: 'الدفع عند الاستلام',
        to: '/my-profits',
        match: (p: string) => p.startsWith('/my-profits') || p.startsWith('/cod-reports'),
      },
      {
        labelKey: 'Returns',
        labelAr: 'المرتجعات',
        to: '/ecommerce-orders/returns',
        match: (p: string) => p.startsWith('/ecommerce-orders/returns') || p.startsWith('/returns'),
      },
    ]
    return (
      <nav
        aria-label={isArabic ? 'تنقل طلبات المتجر' : 'Store orders navigation'}
        className="flex flex-wrap gap-2"
      >
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

  return (
    <nav
      aria-label={isArabic ? section.ariaLabelAr : section.ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {section.items.map((item) => {
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
