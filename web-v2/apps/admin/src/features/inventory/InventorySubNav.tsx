import { Link, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'

const LINKS = [
  { to: '/inventory/stock', en: 'Stock', ar: 'المخزون' },
  { to: '/inventory/ledger', en: 'Ledger', ar: 'السجل' },
  { to: '/inventory/adjustments', en: 'Adjustments', ar: 'التعديلات' },
] as const

export function InventorySubNav() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <nav
      className="flex flex-wrap gap-1 border-b pb-px"
      aria-label={t('Inventory sections', 'أقسام المخزون')}
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.to ||
          (link.to === '/inventory/stock' && pathname.startsWith('/inventory/product')) ||
          (link.to === '/inventory/adjustments' && pathname.startsWith('/inventory/adjustments'))
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
