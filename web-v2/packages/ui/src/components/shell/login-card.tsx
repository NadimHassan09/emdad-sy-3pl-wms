import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/components/ui/avatar'
import { Button } from '@ui/components/ui/button'
import { Checkbox } from '@ui/components/ui/checkbox'
import { Input } from '@ui/components/ui/input'
import { Label } from '@ui/components/ui/label'
import { cn } from '@ui/lib/utils'

export type LoginLabels = {
  email: string
  password: string
  emailPlaceholder?: string
  submit: string
  submitting: string
  remember: string
  showPassword: string
  hidePassword: string
  continue: string
  notYou: string
  removeRemembered: string
  accountSection?: string
}

export type RememberedAccountView = { email: string; displayName: string; avatarUrl?: string | null }

export type LoginCardProps = {
  labels: LoginLabels
  email: string
  password: string
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  loading?: boolean
  error?: string | null
  remember: boolean
  onRememberChange: (v: boolean) => void
  remembered?: RememberedAccountView | null
  /** When true, show the “Continue as …” chooser instead of the credential form. */
  offerContinue?: boolean
  onContinue?: () => void
  onClearRemembered?: () => void
  onShowCredentialForm?: () => void
  oauthSlot?: ReactNode
  /** Hide the remember-me checkbox (portals that do not support it). */
  hideRemember?: boolean
  /** Disable browser autofill (e.g. after “Not you?” with an empty form). */
  disableAutofill?: boolean
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Presentational login form shared by both portals. All behaviour is injected by the page. */
export function LoginCard(p: LoginCardProps) {
  const [show, setShow] = useState(false)
  const uid = useId()
  const emailId = `${uid}-email`
  const pwId = 'login-password'
  const canContinue = Boolean(p.onContinue && p.remembered)

  return (
    <div className="space-y-5">
      {p.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-tone-danger-border bg-tone-danger-bg p-3 text-sm text-tone-danger-fg">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{p.error}</span>
        </div>
      ) : null}

      {p.remembered ? (
        <div className="relative">
          <button
            type="button"
            disabled={p.loading || !canContinue}
            onClick={() => p.onContinue?.()}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border bg-muted/50 p-3 pe-12 text-start transition-colors',
              canContinue && 'hover:border-primary/40 hover:bg-muted',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:opacity-60',
            )}
            aria-label={p.labels.continue}
          >
            <Avatar className="size-10">
              {p.remembered.avatarUrl ? <AvatarImage src={p.remembered.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                {initials(p.remembered.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.remembered.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                {p.remembered.email}
              </span>
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-1.5 top-1/2 -translate-y-1/2"
            onClick={(e) => {
              e.stopPropagation()
              p.onClearRemembered?.()
            }}
            aria-label={p.labels.removeRemembered}
            title={p.labels.removeRemembered}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      {p.offerContinue ? (
        <div className="space-y-3">
          <Button type="button" className="w-full" size="lg" onClick={p.onContinue} disabled={p.loading}>
            {p.loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {p.labels.continue}
            <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={p.onShowCredentialForm}>
            {p.labels.notYou}
          </Button>
        </div>
      ) : (
        <form onSubmit={p.onSubmit} className="space-y-4" noValidate={false} autoComplete={p.disableAutofill ? 'off' : undefined}>
          <div className="space-y-2">
            <Label htmlFor={emailId}>{p.labels.email}</Label>
            <Input
              id={emailId}
              name={p.disableAutofill ? 'emdad-login-email' : 'username'}
              type="email"
              inputMode="email"
              autoComplete={p.disableAutofill ? 'off' : 'username'}
              required
              dir="ltr"
              className="h-11 text-start"
              placeholder={p.labels.emailPlaceholder}
              value={p.email}
              onChange={(e) => p.onEmailChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={pwId}>{p.labels.password}</Label>
            <div className="relative">
              <Input
                id={pwId}
                name={p.disableAutofill ? 'emdad-login-password' : 'password'}
                type={show ? 'text' : 'password'}
                autoComplete={p.disableAutofill ? 'off' : 'current-password'}
                required
                dir="ltr"
                className="h-11 pe-11 text-start"
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                aria-label={show ? p.labels.hidePassword : p.labels.showPassword}
                title={show ? p.labels.hidePassword : p.labels.showPassword}
                className="absolute inset-y-0 end-1 my-auto grid size-9 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {p.hideRemember ? null : (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={p.remember} onCheckedChange={(v) => p.onRememberChange(v === true)} />
              {p.labels.remember}
            </label>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={p.loading}>
            {p.loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {p.loading ? p.labels.submitting : p.labels.submit}
          </Button>
          {p.oauthSlot}
        </form>
      )}
    </div>
  )
}
