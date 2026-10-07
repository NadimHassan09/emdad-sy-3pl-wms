import type { ReactNode } from 'react'
import { FilterBar } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

/** Minimal filter shell for ported task execution line filters. */
export function FilterPanel({
  title,
  children,
  onApply,
  onReset,
  loading,
  applyLabel = 'Apply',
  resetLabel = 'Reset',
  className,
}: {
  title?: string
  children: ReactNode
  onApply?: () => void
  onReset?: () => void
  loading?: boolean
  applyLabel?: string
  resetLabel?: string
  className?: string
}) {
  return (
    <FilterBar className={className ?? 'mb-3'}>
      {title ? <p className="mb-2 text-sm font-medium">{title}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      {onApply || onReset ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onApply ? (
            <Button type="button" size="sm" onClick={onApply} disabled={loading}>
              {applyLabel}
            </Button>
          ) : null}
          {onReset ? (
            <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={loading}>
              {resetLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </FilterBar>
  )
}
