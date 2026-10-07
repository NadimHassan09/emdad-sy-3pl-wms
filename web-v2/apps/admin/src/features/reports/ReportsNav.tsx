import { Link, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'
import { REPORT_CATALOG } from '@/lib/reports/report-catalog'

export function ReportsNav() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const items = REPORT_CATALOG.filter((entry) => entry.path.startsWith('/reports/'))

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t('Reports navigation', 'تنقل التقارير')}
    >
      {items.map((entry) => {
        const active = pathname === entry.path
        return (
          <Link
            key={entry.id}
            to={entry.path}
            className={cn(
              'shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isArabic ? entry.titleAr : entry.title}
          </Link>
        )
      })}
    </nav>
  )
}
