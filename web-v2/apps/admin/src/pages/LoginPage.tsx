import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Globe, Moon, Sun } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { AuthLayout, LoginCard } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { AuthApi } from '@/api/auth'
import { useAuth } from '@/auth/AuthContext'
import {
  clearAccessToken,
  clearContinueSession,
  clearRememberedAccount,
  canContinueSession,
  consumePostLoginReturnTo,
  endLogoutFlow,
  getRememberedAccount,
  isPersistSessionEnabled,
  isSafeReturnPath,
  markContinueSessionAvailable,
  setAccessToken,
  setRememberedAccount,
  type RememberedAccount,
} from '@/auth/authStorage'
import { adminMediaSrc } from '@/lib/admin-media'
import { canAccessPath, defaultHomePath } from '@/lib/rbac'
import { getLoginErrorMessage } from '@/lib/loginError'

function resolveRememberedAvatar(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  if (url.startsWith('/api/') || /^https?:\/\//i.test(url)) return url
  return adminMediaSrc(url)
}

function googleLoginErrorMessage(code: string | null, ar: boolean): string | null {
  if (!code) return null
  const t = (en: string, a: string) => (ar ? a : en)
  switch (code) {
    case 'google_not_linked':
      return t('This Google account is not linked to an existing account. Please contact your administrator.', 'حساب Google هذا غير مرتبط بحساب موجود. يرجى التواصل مع المسؤول.')
    case 'google_inactive':
      return t('This account is inactive and cannot sign in.', 'هذا الحساب غير نشط ولا يمكن تسجيل الدخول.')
    case 'google_forbidden':
      return t('This account cannot access the admin system.', 'لا يمكن لهذا الحساب الوصول إلى نظام الإدارة.')
    case 'google_denied':
      return t('Google Sign-In was cancelled.', 'تم إلغاء تسجيل الدخول عبر Google.')
    case 'google_conflict':
      return t('This Google account is already linked to another user.', 'حساب Google هذا مرتبط بمستخدم آخر بالفعل.')
    case 'google_unavailable':
      return t('Google Sign-In is not available right now.', 'تسجيل الدخول عبر Google غير متاح حالياً.')
    default:
      return t('Google Sign-In failed. Please try again.', 'فشل تسجيل الدخول عبر Google. حاول مرة أخرى.')
  }
}

function resolvePostLoginTarget(role: string | undefined, candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    if (isSafeReturnPath(c) && canAccessPath(role, c)) return c
  }
  return defaultHomePath(role)
}

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
    <path fill="#34A853" d="M6.6 14.3l-.5.4-2.2 1.7C5.5 19.2 8.5 21 12 21c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.4z" />
    <path fill="#4A90E2" d="M4 9c-.6 1.1-.9 2.3-.9 3.6s.3 2.5.9 3.6c0 .1 2.7-2.1 2.7-2.1-.2-.5-.3-1-.3-1.5s.1-1 .3-1.5L4 9z" />
    <path fill="#FBBC05" d="M12 4.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 1.7 14.4 1 12 1 8.5 1 5.5 2.8 4 5.7L6.7 7.8C7.9 5.9 9.8 4.5 12 4.5z" />
  </svg>
)

export function LoginPage() {
  const { user, booting, login, resumeSession, refresh } = useAuth()
  const { isArabic, toggleLanguage, theme, toggleTheme } = useUiPreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const nextQuery = searchParams.get('next')
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const initialRemembered = useMemo(() => getRememberedAccount(), [])
  const initialCanContinue = useMemo(() => Boolean(initialRemembered) && canContinueSession(), [initialRemembered])
  const [remembered, setRemembered] = useState<RememberedAccount | null>(initialRemembered)
  const [email, setEmail] = useState(initialRemembered?.email ?? '')
  const [password, setPassword] = useState('')
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(initialRemembered) || isPersistSessionEnabled())
  const [showCredentialForm, setShowCredentialForm] = useState(!initialCanContinue)
  /** After “Not you?” — empty fields, no browser autofill of the remembered email. */
  const [switchedAccount, setSwitchedAccount] = useState(false)
  const [error, setError] = useState<string | null>(() => googleLoginErrorMessage(searchParams.get('google_error'), isArabic))
  const [submitting, setSubmitting] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleCompleting, setGoogleCompleting] = useState(() => searchParams.get('google_auth') === 'success')

  useEffect(() => {
    endLogoutFlow()
  }, [])

  useEffect(() => {
    let cancelled = false
    void AuthApi.googleStatus()
      .then((s) => !cancelled && setGoogleEnabled(Boolean(s.enabled)))
      .catch(() => !cancelled && setGoogleEnabled(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const code = searchParams.get('google_error')
    if (code) {
      setError(googleLoginErrorMessage(code, isArabic))
      setShowCredentialForm(true)
    }
  }, [searchParams, isArabic])

  useEffect(() => {
    if (searchParams.get('google_auth') !== 'success') return
    let cancelled = false
    setGoogleCompleting(true)
    setSubmitting(true)
    void (async () => {
      try {
        const persist = searchParams.get('persist') === '1'
        const refreshed = await AuthApi.refreshSession()
        setAccessToken(refreshed.access_token, persist)
        if (persist) markContinueSessionAvailable()
        const me = await AuthApi.me()
        await refresh()
        if (cancelled) return
        if (persist && me.email) {
          const account = {
            email: me.email,
            displayName: me.fullName?.trim() || me.email,
            avatarUrl: me.avatarUrl ? `/api/client/media/${me.avatarUrl.replace(/^\/media\//, '').replace(/^\/+/, '')}` : null,
          }
          setRememberedAccount(account)
          setRemembered(account)
        }
        const stored = consumePostLoginReturnTo()
        navigate(resolvePostLoginTarget(me.role, [fromState, nextQuery, stored]), { replace: true })
      } catch {
        if (!cancelled) {
          setGoogleCompleting(false)
          setError(isArabic ? 'اكتمل تسجيل Google لكن استعادة الجلسة فشلت. حاول مرة أخرى.' : 'Google Sign-In completed but session restore failed. Please try again.')
          setShowCredentialForm(true)
        }
      } finally {
        if (!cancelled) setSubmitting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, refresh, navigate, fromState, nextQuery, isArabic])

  const toolbar = (
    <>
      <Button variant="ghost" onClick={toggleLanguage} className="gap-1.5">
        <Globe aria-hidden />
        {isArabic ? 'English' : 'العربية'}
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('Toggle theme', 'تبديل المظهر')}>
        {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
      </Button>
    </>
  )

  if (booting || googleCompleting) {
    return (
      <AuthLayout title={googleCompleting ? t('Signing in with Google…', 'جاري تسجيل الدخول عبر Google…') : t('Loading…', 'جاري التحميل…')} toolbar={toolbar}>
        <div className="h-16" aria-busy="true" />
      </AuthLayout>
    )
  }

  if (user) {
    const stored = consumePostLoginReturnTo()
    return <Navigate to={resolvePostLoginTarget(user.role, [fromState, nextQuery, stored])} replace />
  }

  async function clearRemembered() {
    try {
      await AuthApi.logout({ soft: false })
    } catch {
      /* ignore */
    }
    clearRememberedAccount()
    clearContinueSession()
    clearAccessToken()
    setRemembered(null)
    setEmail('')
    setPassword('')
    setRememberFor30Days(false)
    setSwitchedAccount(false)
    setShowCredentialForm(true)
    setError(null)
  }

  async function selectRememberedAccount() {
    if (!remembered) return
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await resumeSession()
      const stored = consumePostLoginReturnTo()
      navigate(resolvePostLoginTarget(loggedIn.role, [fromState, nextQuery, stored]), { replace: true })
    } catch {
      clearContinueSession()
      clearAccessToken({ keepPersist: true })
      setEmail(remembered.email)
      setRememberFor30Days(true)
      setShowCredentialForm(true)
      setError(t('Your saved session expired. Enter your password to continue.', 'انتهت الجلسة المحفوظة. أدخل كلمة المرور للمتابعة.'))
      window.setTimeout(() => document.getElementById('login-password')?.focus(), 0)
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const trimmed = email.trim()
      const loggedIn = await login(trimmed, password, { persistSession: rememberFor30Days })
      if (rememberFor30Days) {
        markContinueSessionAvailable()
        // AuthContext.login already wrote remembered account (incl. avatar) — don't overwrite without it.
        const saved = getRememberedAccount()
        const account = saved ?? {
          email: loggedIn.email || trimmed,
          displayName: loggedIn.fullName || loggedIn.email || trimmed,
          avatarUrl: resolveRememberedAvatar(loggedIn.avatarUrl),
        }
        if (!saved) setRememberedAccount(account)
        setRemembered(account)
        setSwitchedAccount(false)
      } else {
        clearRememberedAccount()
        clearContinueSession()
        setRemembered(null)
      }
      const stored = consumePostLoginReturnTo()
      navigate(resolvePostLoginTarget(loggedIn.role, [fromState, nextQuery, stored]), { replace: true })
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err, isArabic))
    } finally {
      setSubmitting(false)
    }
  }

  const offerContinue = Boolean(remembered && canContinueSession() && !showCredentialForm)
  const rememberedForUi = remembered
    ? { ...remembered, avatarUrl: resolveRememberedAvatar(remembered.avatarUrl) }
    : null

  const oauthSlot =
    googleEnabled && !offerContinue ? (
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t('OR', 'أو')}
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled={submitting} onClick={() => window.location.assign(AuthApi.googleLoginUrl({ rememberMe: rememberFor30Days }))}>
          <GoogleMark />
          {t('Sign in with Google', 'تسجيل الدخول عبر Google')}
        </Button>
      </div>
    ) : null

  return (
    <AuthLayout
      title={t('Welcome back', 'مرحبًا بعودتك')}
      subtitle={t('Sign in to manage warehouse operations.', 'سجّل الدخول لإدارة عمليات المستودع.')}
      toolbar={toolbar}
      heroTitle={t('Every pallet, order and task in one place.', 'كل منصة وطلب ومهمة في مكان واحد.')}
      heroText={t('Emdad WMS keeps your 3PL warehouse accurate, auditable and on time.', 'يحافظ نظام إمداد على دقة مستودعك وإمكانية تدقيقه وانضباط مواعيده.')}
    >
      <LoginCard
        labels={{
          email: t('Email', 'البريد الإلكتروني'),
          password: t('Password', 'كلمة المرور'),
          emailPlaceholder: 'you@company.com',
          submit: t('Sign in', 'تسجيل الدخول'),
          submitting: t('Signing in…', 'جاري تسجيل الدخول…'),
          remember: t('Remember me for 30 days', 'تذكرني لمدة 30 يومًا'),
          showPassword: t('Show password', 'إظهار كلمة المرور'),
          hidePassword: t('Hide password', 'إخفاء كلمة المرور'),
          continue: t('Continue', 'متابعة'),
          notYou: t('Not you?', 'لست أنت؟'),
          removeRemembered: t('Remove remembered account', 'إزالة الحساب المحفوظ'),
        }}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={onSubmit}
        loading={submitting}
        error={error}
        remember={rememberFor30Days}
        onRememberChange={(next) => {
          setRememberFor30Days(next)
          if (!next) setShowCredentialForm(true)
        }}
        remembered={rememberedForUi}
        offerContinue={offerContinue}
        onContinue={() => void selectRememberedAccount()}
        onClearRemembered={() => void clearRemembered()}
        onShowCredentialForm={() => {
          // Keep remembered card (clickable Continue) but clear fields — no prefilled email.
          setShowCredentialForm(true)
          setSwitchedAccount(true)
          setEmail('')
          setPassword('')
          setError(null)
        }}
        disableAutofill={switchedAccount}
        oauthSlot={oauthSlot}
      />
    </AuthLayout>
  )
}
