import type { ReactNode } from 'react'
import loginCoverUrl from '@ui/assets/login-cover.jpg'
import { BrandLogo } from './brand-logo'
import { cn } from '@ui/lib/utils'

/**
 * Split-screen auth layout. Brand panel (photo + green overlay) on ≥lg, form card on the canvas.
 * Toolbar slot (language/theme) sits at the top end.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  toolbar,
  heroTitle,
  heroText,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  toolbar?: ReactNode
  heroTitle?: ReactNode
  heroText?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-h-svh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]', className)}>
      <aside className="bg-sidebar-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <img
          src={loginCoverUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full scale-105 select-none object-cover blur-[2px]"
        />
        {/* Dark green wash — hides fine detail while keeping the scene readable */}
        <div className="absolute inset-0 bg-sidebar/70" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar/95 via-sidebar/35 to-sidebar/50" aria-hidden />
        <BrandLogo tone="onDark" className="relative" />
        <div className="relative max-w-md space-y-3">
          {heroTitle ? <h2 className="text-3xl font-semibold leading-tight">{heroTitle}</h2> : null}
          {heroText ? <p className="text-base text-sidebar-foreground/90">{heroText}</p> : null}
        </div>
      </aside>
      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        {toolbar ? <div className="absolute end-4 top-4 flex items-center gap-1">{toolbar}</div> : null}
        <div className="w-full max-w-md space-y-6">
          <BrandLogo tone="onLight" className="lg:hidden" />
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {children}
          </div>
          {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
