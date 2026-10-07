import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@ui/lib/utils'

/**
 * Polarity-aware change indicator.
 * `goodWhen="up"` → increase is green, decrease is red (revenue, orders).
 * `goodWhen="down"` → decrease is green (backlog, overdue, returns).
 * Zero / unknown is neutral. This replaces hard-coded green/red arrows.
 */
export function Delta({
  value,
  goodWhen = 'up',
  suffix = '%',
  label,
  className,
}: {
  value: number | null | undefined
  goodWhen?: 'up' | 'down'
  suffix?: string
  label?: string
  className?: string
}) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-muted-foreground', className)}>
        <Minus className="size-3.5" aria-hidden />
        <span className="tabular" dir="ltr">0{suffix}</span>
        {label ? <span className="font-normal">{label}</span> : null}
      </span>
    )
  }
  const up = value > 0
  const good = goodWhen === 'up' ? up : !up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        good ? 'text-tone-success-fg' : 'text-tone-danger-fg',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular" dir="ltr">
        {up ? '+' : '−'}
        {Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}
        {suffix}
      </span>
      {label ? <span className="font-normal text-muted-foreground">{label}</span> : null}
    </span>
  )
}
