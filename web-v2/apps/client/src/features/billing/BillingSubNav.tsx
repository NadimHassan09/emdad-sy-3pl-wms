import { NavLink, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'

const LINKS = [
  { to: '/billing', en: 'Billing', ar: 'الفوترة', match: (p: string) => p === '/billing' || p.startsWith('/billing/') },
  {
    to: '/invoices',
    en: 'Invoices',
    ar: 'الفواتير',
    match: (p: string) => p.startsWith('/invoices'),
  },
] as const

export function BillingSubNav() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <nav
      aria-label={t('Billing sections', 'أقسام الفوترة')}
      className="flex flex-wrap gap-2"
    >
      {LINKS.map((link) => {
        const active = link.match(pathname)
        return (
          <NavLink
            key={link.to}
            to={link.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t(link.en, link.ar)}
          </NavLink>
        )
      })}
    </nav>
  )
}
