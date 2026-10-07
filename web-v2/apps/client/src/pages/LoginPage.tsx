import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Globe, Moon, Sun } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { AuthLayout, LoginCard } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { useAuth } from '@/auth/AuthContext'
import { clientMediaSrc } from '@/lib/client-media'
import { clearRememberedAccount, getRememberedAccount, setRememberedAccount, type RememberedAccount } from '@/services/authStorage'
import { getLoginErrorMessage } from '@/utils/loginError'

function safeFrom(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/login')) return '/dashboard'
  return from
}

export function LoginPage() {
  const { user, bootstrapped, login, resumeSession } = useAuth()
  const { isArabic, toggleLanguage, theme, toggleTheme } = useUiPreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const from = safeFrom((location.state as { from?: string } | null)?.from)
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const initialRemembered = useMemo(() => getRememberedAccount(), [])
  const [remembered, setRemembered] = useState<RememberedAccount | null>(initialRemembered)
  const [email, setEmail] = useState(initialRemembered?.email ?? '')
  const [password, setPassword] = useState('')
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(initialRemembered))
  const [showCredentialForm, setShowCredentialForm] = useState(!initialRemembered)
  /** After “Not you?” — empty fields, no browser autofill of the remembered email. */
  const [switchedAccount, setSwitchedAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  if (!bootstrapped) {
    return (
      <AuthLayout title={t('Loading…', 'جاري التحميل…')} toolbar={toolbar}>
        <div className="h-16" aria-busy="true" />
      </AuthLayout>
    )
  }
  if (user) return <Navigate to={from} replace />

  function clearRemembered() {
    clearRememberedAccount()
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
      await resumeSession()
      navigate(from, { replace: true })
    } catch {
      // No live session (e.g. after logout): fall through to password entry quietly.
      setEmail(remembered.email)
      setRememberFor30Days(true)
      setShowCredentialForm(true)
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
      const me = await login(trimmed, password, { persistSession: rememberFor30Days })
      if (rememberFor30Days) {
        const account: RememberedAccount = {
          email: me.email || trimmed,
          displayName: me.companyName || me.fullName || me.email || trimmed,
          avatarUrl: me.avatarUrl ?? null,
        }
        setRememberedAccount(account)
        setRemembered(account)
        setSwitchedAccount(false)
      } else {
        clearRememberedAccount()
        setRemembered(null)
      }
      navigate(from, { replace: true })
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      if (/inactive|غير نشط/i.test(raw)) {
        navigate('/account-inactive', { replace: true })
        return
      }
      setError(getLoginErrorMessage(err, isArabic))
    } finally {
      setSubmitting(false)
    }
  }

  const rememberedForUi = remembered
    ? { ...remembered, avatarUrl: remembered.avatarUrl ? (clientMediaSrc(remembered.avatarUrl) ?? remembered.avatarUrl) : null }
    : null

  return (
    <AuthLayout
      title={t('Welcome back', 'مرحبًا بعودتك')}
      subtitle={t('Sign in to manage orders, COD, and inventory.', 'سجّل الدخول لإدارة الطلبات والتحصيل والمخزون.')}
      toolbar={toolbar}
      heroTitle={t('Your orders, stock and cash in one place.', 'طلباتك ومخزونك وتحصيلك في مكان واحد.')}
      heroText={t('Follow every order from your store to your customer, with live inventory and COD tracking.', 'تابع كل طلب من متجرك حتى عميلك، مع مخزون مباشر وتتبع للتحصيل.')}
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
        onRememberChange={setRememberFor30Days}
        remembered={rememberedForUi}
        offerContinue={Boolean(remembered) && !showCredentialForm}
        onContinue={() => void selectRememberedAccount()}
        onClearRemembered={clearRemembered}
        onShowCredentialForm={() => {
          setShowCredentialForm(true)
          setSwitchedAccount(true)
          setEmail('')
          setPassword('')
          setError(null)
        }}
        disableAutofill={switchedAccount}
      />
    </AuthLayout>
  )
}
