import type { ReactNode } from 'react'
import { cn } from '@ui/lib/utils'
import { toneClasses, type Tone } from '@ui/status/tones'

export type StatusCardItem = {
  key: string
  label: ReactNode
  count: number | string
  tone: Tone
}

/**
 * Status summary cards that act as FILTERS (same behaviour as the legacy OMS
 * pages: click = filter the list, click again/“All” = clear).
 * Soft tone background + dark tone text (>=4.5:1), count dominant, selected = ring.
 */
export function StatusCards({
  items,
  selectedKey,
  onSelect,
  className,
  ariaLabel,
}: {
  items: StatusCardItem[]
  selectedKey: string | null
  onSelect: (key: string) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        // phones: horizontal scroll rail; ≥md: wrapping grid
        'flex snap-x gap-2.5 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5 2xl:grid-cols-10',
        className,
      )}
    >
      {items.map((it) => {
        const t = toneClasses[it.tone]
        const selected = selectedKey === it.key
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(it.key)}
            className={cn(
              'flex min-h-16 min-w-36 shrink-0 snap-start flex-col items-start justify-between gap-1 rounded-xl border px-3.5 py-2.5 text-start transition md:min-w-0',
              t.bg,
              t.border,
              t.text,
              'hover:brightness-[0.98] focus-visible:outline-2',
              selected && cn('ring-2 ring-offset-2 ring-offset-sheet', t.ring),
            )}
          >
            <span className="tabular text-xl font-semibold leading-6">{it.count}</span>
            <span className="text-xs font-medium leading-4">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
