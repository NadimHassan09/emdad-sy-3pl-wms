import { Link, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'

const LINKS = [
  { to: '/billing/dashboard', en: 'Dashboard', ar: 'لوحة التحكم' },
  { to: '/billing/plans', en: 'Plans', ar: 'الخطط' },
  { to: '/billing/invoices', en: 'Invoices', ar: 'الفواتير' },
] as const

export function BillingSubNav() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <nav
      className="flex flex-wrap gap-1 border-b pb-px"
      aria-label={t('Billing sections', 'أقسام الفوترة')}
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.to ||
          (link.to === '/billing/dashboard' && pathname === '/billing') ||
          (link.to === '/billing/plans' &&
            (pathname.startsWith('/billing/plans') || pathname.startsWith('/billing/templates'))) ||
          (link.to === '/billing/invoices' && pathname.startsWith('/billing/invoices'))
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(link.en, link.ar)}
          </Link>
        )
      })}
    </nav>
  )
}
