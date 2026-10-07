import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from '@ui/lib/link'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card'
import { cn } from '@ui/lib/utils'
import { ErrorState } from '@ui/components/feedback/empty-state'

/** Dashboard widget: titled card with an optional "view all" action. */
export function Widget({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('h-full gap-4 py-5 shadow-none', className)}>
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn('px-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

export function WidgetLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-brand-800">
      {children}
      <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
    </Link>
  )
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function WidgetError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return <ErrorState className="py-6" title={message} retryLabel={retryLabel} onRetry={onRetry} />
}
