import type { ReactNode } from 'react'
import bannerUrl from '@ui/assets/banner-warehouse.jpg'
import { cn } from '@ui/lib/utils'

/** Greeting banner with the Emdad warehouse artwork (mock-up style). */
export function WelcomeBanner({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-xl border bg-gradient-to-r from-brand-100 via-brand-50 to-brand-100 px-5 py-5 sm:px-6',
        className,
      )}
    >
      <img
        src={bannerUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-0 -z-10 hidden h-full w-auto max-w-[62%] select-none object-cover opacity-90 [mask-image:linear-gradient(to_left,black_60%,transparent)] sm:block rtl:[mask-image:linear-gradient(to_right,black_60%,transparent)]"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle ? <p className="text-sm text-foreground/75">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
