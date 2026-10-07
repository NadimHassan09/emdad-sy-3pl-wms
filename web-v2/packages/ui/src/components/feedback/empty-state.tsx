import type { ComponentType, ReactNode } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-brand-100 text-brand-800">
        <Icon className="size-6" />
      </span>
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  retryLabel?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-tone-danger-bg text-tone-danger-fg">
        <AlertCircle className="size-6" />
      </span>
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          {retryLabel ?? 'Retry'}
        </Button>
      ) : null}
    </div>
  )
}
