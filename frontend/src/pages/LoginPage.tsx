import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen, useUiTheme } from '@ds';
import { useAuth } from '../auth/AuthContext';
import {
  clearRememberedAccount,
  getRememberedAccount,
  setRememberedAccount,
  type RememberedAccount,
} from '../auth/authStorage';
import { canAccessPath, defaultHomePath } from '../lib/rbac';
import { getLoginErrorMessage } from '../lib/loginError';

const LANG_KEY = 'wms-ui-language';
const LANG_EVENT = 'wms-ui-language-changed';

function setAdminLanguage(next: 'EN' | 'AR'): void {
  window.localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next === 'AR' ? 'ar' : 'en';
  document.documentElement.dir = next === 'AR' ? 'rtl' : 'ltr';
  window.dispatchEvent(new Event(LANG_EVENT));
}

function useIsArabic(): boolean {
  const [isArabic, setIsArabic] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.localStorage.getItem(LANG_KEY) === 'AR' || document.documentElement.dir === 'rtl'),
  );
  useEffect(() => {
    const sync = () =>
      setIsArabic(
        window.localStorage.getItem(LANG_KEY) === 'AR' || document.documentElement.dir === 'rtl',
      );
    window.addEventListener(LANG_EVENT, sync);
    return () => window.removeEventListener(LANG_EVENT, sync);
  }, []);
  return isArabic;
}

export function LoginPage() {
  const { user, booting, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const isArabic = useIsArabic();
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const initialRemembered = useMemo(() => getRememberedAccount(), []);
  const [remembered, setRemembered] = useState<RememberedAccount | null>(initialRemembered);
  const [email, setEmail] = useState(initialRemembered?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(initialRemembered));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useUiTheme({ storageKey: 'admin-ui-theme' });

  if (booting) {
    return (
      <div id="admin-root" dir={isArabic ? 'rtl' : 'ltr'}>
        <LoginScreen
          title=""
          subtitle=""
          email=""
          password=""
          onEmailChange={() => {}}
          onPasswordChange={() => {}}
          onSubmit={() => {}}
          bootSlot={
            <div className="flex flex-col items-center gap-3">
              <img src="/emdad-logo.png" alt="EMDAD" className="h-10 w-auto object-contain" />
              {t('Loading…', 'جاري التحميل…')}
            </div>
          }
        />
      </div>
    );
  }

  if (user) {
    const home = defaultHomePath(user.role);
    const target = fromState && canAccessPath(user.role, fromState) ? fromState : home;
    return <Navigate to={target} replace />;
  }

  function clearRemembered() {
    clearRememberedAccount();
    setRemembered(null);
    setEmail('');
    setPassword('');
    setRememberFor30Days(false);
    setError(null);
  }

  function selectRememberedAccount() {
    if (!remembered) return;
    setEmail(remembered.email);
    setRememberFor30Days(true);
    window.setTimeout(() => {
      document.getElementById('login-password')?.focus();
    }, 0);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const loggedIn = await login(trimmedEmail, password, {
        persistSession: rememberFor30Days,
      });
      if (rememberFor30Days) {
        const account = {
          email: loggedIn.email || trimmedEmail,
          displayName: loggedIn.fullName || loggedIn.email || trimmedEmail,
        };
        setRememberedAccount(account);
        setRemembered(account);
      } else {
        clearRememberedAccount();
        setRemembered(null);
      }
      const home = defaultHomePath(loggedIn.role);
      const target = fromState && canAccessPath(loggedIn.role, fromState) ? fromState : home;
      navigate(target, { replace: true });
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err, isArabic));
    } finally {
      setSubmitting(false);
    }
  }

  const languageToggle = (
    <button
      type="button"
      onClick={() => setAdminLanguage(isArabic ? 'EN' : 'AR')}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-body shadow-sm transition-colors hover:bg-white"
      style={{ backgroundColor: '#ffffff' }}
    >
      <i className="fa-solid fa-globe text-brand-600" aria-hidden />
      {isArabic ? 'English' : 'العربية'}
    </button>
  );

  return (
    <div id="admin-root" dir={isArabic ? 'rtl' : 'ltr'}>
      <LoginScreen
        title={t('Welcome back', 'مرحبًا بعودتك')}
        subtitle={t(
          'Sign in to manage warehouse operations.',
          'سجّل الدخول لإدارة عمليات المستودع.',
        )}
        emailLabel={t('Email', 'البريد الإلكتروني')}
        passwordLabel={t('Password', 'كلمة المرور')}
        emailPlaceholder="you@company.com"
        submitLabel={t('Sign in', 'تسجيل الدخول')}
        submittingLabel={t('Signing in…', 'جاري تسجيل الدخول…')}
        rememberLabel={t('Remember me for 30 days', 'تذكرني لمدة 30 يومًا')}
        accountSectionLabel={t('Sign in to your account', 'تسجيل الدخول إلى حسابك')}
        clearRememberedAccountLabel={t('Remove remembered account', 'إزالة الحساب المحفوظ')}
        orLabel={t('OR', 'أو')}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={onSubmit}
        loading={submitting}
        error={error}
        remember={rememberFor30Days}
        onRememberChange={setRememberFor30Days}
        cornerSlot={languageToggle}
        rememberedAccount={remembered}
        onSelectRememberedAccount={selectRememberedAccount}
        onClearRememberedAccount={clearRemembered}
      />
    </div>
  );
}
