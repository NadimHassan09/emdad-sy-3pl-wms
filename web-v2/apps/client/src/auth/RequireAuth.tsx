import type { ReactElement, ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const { user, bootstrapped } = useAuth()
  const { isArabic } = useUiPreferences()
  const location = useLocation()

  if (!bootstrapped) {
    return (
      <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground" aria-busy="true">
        {isArabic ? 'جاري التحميل…' : 'Loading…'}
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return <>{children}</>
}
