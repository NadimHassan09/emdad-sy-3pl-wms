import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { cn, toneClasses, type Tone } from '@emdad/ui'
import { useAuth } from '@/auth/AuthContext'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { roleAccessDeniedCopy, type BillingRestrictionVariant } from '@/lib/client-billing-restriction'
import { isClientAdmin } from '@/lib/rbac'

const VARIANT: Record<BillingRestrictionVariant, { tone: Tone; Icon: typeof Info }> = {
  error: { tone: 'danger', Icon: OctagonAlert },
  warning: { tone: 'warning', Icon: AlertTriangle },
  info: { tone: 'progress', Icon: Info },
}

export function Banner({ variant, title, children }: { variant: BillingRestrictionVariant; title: ReactNode; children?: ReactNode }) {
  const { tone, Icon } = VARIANT[variant]
  const t = toneClasses[tone]
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', t.bg, t.border, t.text)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        {children ? <p className="mt-0.5">{children}</p> : null}
      </div>
    </div>
  )
}

/** Billing state notice (restricted / no plan / expiring). Hidden on /billing when ops are allowed. */
export function BillingRestrictionBanner() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { isArabic } = useUiPreferences()
  const { isLoading, restriction, operationalAllowed } = useClientOperationalAccess(isArabic)
  if (isLoading || !restriction.showBanner) return null
  if (pathname.startsWith('/billing') && operationalAllowed) return null
  return (
    <Banner variant={restriction.variant} title={restriction.title}>
      {restriction.description}
      {isClientAdmin(user?.role) ? (
        <>
          {' '}
          <Link to="/billing" className="font-medium underline underline-offset-4">
            {isArabic ? 'عرض الفوترة' : 'View billing'}
          </Link>
        </>
      ) : null}
    </Banner>
  )
}

/** One-time notice after a role-based redirect from RequireRouteAccess. */
export function ClientRoleAccessBanner() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isArabic } = useUiPreferences()
  const deniedPath = (location.state as { accessDenied?: string } | null)?.accessDenied
  useEffect(() => {
    if (deniedPath) navigate(location.pathname + location.search, { replace: true, state: {} })
  }, [deniedPath, location.pathname, location.search, navigate])
  if (!deniedPath) return null
  const copy = roleAccessDeniedCopy(deniedPath, isArabic)
  return (
    <Banner variant={copy.variant} title={copy.title}>
      {copy.description}
    </Banner>
  )
}
