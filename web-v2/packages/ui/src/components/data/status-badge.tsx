import type { ReactNode } from 'react'
import { cn } from '@ui/lib/utils'
import { toneClasses, type Tone } from '@ui/status/tones'

/** Status pill: dot + label. Never truncates (fixes "Pending A" on mobile). */
export function StatusBadge({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  const t = toneClasses[tone]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        t.soft,
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', t.dot)} /> : null}
      {children}
    </span>
  )
}
