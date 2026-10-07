import type { ReactNode } from 'react'

export function BillingFormSection({
  title,
  description,
  children,
  bordered = true,
}: {
  title: string
  description?: string
  children: ReactNode
  bordered?: boolean
}) {
  return (
    <div
      className={
        bordered
          ? 'grid gap-6 border-b pb-6 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(200px,240px)_1fr]'
          : 'grid gap-6 lg:grid-cols-[minmax(200px,240px)_1fr]'
      }
    >
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function numField(v: string): number {
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : 0
}
