import type { ComponentType, ReactNode } from 'react'
import { Link } from '@ui/lib/link'
import { cn } from '@ui/lib/utils'
import { Skeleton } from '@ui/components/ui/skeleton'

export type KpiCardProps = {
  title: string
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  /** Delta / sub-line (e.g. `<Delta .../>` or breakdown text) */
  footer?: ReactNode
  /** Right-hand visual (Sparkline etc.) */
  visual?: ReactNode
  href?: string
  loading?: boolean
  className?: string
}

/** Single KPI tile in the Square-UI dashboard style (title row, big value, footer). */
export function KpiCard({ title, value, icon: Icon, footer, visual, href, loading, className }: KpiCardProps) {
  const body = (
    <div
      className={cn(
        'group flex h-full min-w-0 flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors sm:p-5',
        href && 'hover:border-brand-500/50 hover:bg-brand-50',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800">
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="tabular truncate text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">{value}</p>
          )}
          {footer ? <div className="mt-1 text-xs text-muted-foreground">{footer}</div> : null}
        </div>
        {visual ? <div className="h-10 w-20 shrink-0 sm:w-24">{visual}</div> : null}
      </div>
    </div>
  )
  return href ? (
    <Link to={href} className="block h-full rounded-xl no-underline focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  )
}

/** Responsive KPI grid: 1 col on phones, 2 on tablets, N on desktop. */
export function KpiStrip({ children, className, cols = 4 }: { children: ReactNode; className?: string; cols?: 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 sm:gap-4',
        cols === 3 && 'lg:grid-cols-3',
        cols === 4 && 'lg:grid-cols-4',
        cols === 5 && 'lg:grid-cols-3 2xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  )
}
