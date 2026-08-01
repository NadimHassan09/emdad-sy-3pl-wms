import type { FormEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen, useUiTheme } from '@ds';
import { useAuth } from '../auth/AuthContext';
import { useClientArabic } from '../lib/client-ui-language';
import { clientMediaSrc } from '../lib/client-media';
import {
  clearRememberedAccount,
  getRememberedAccount,
  setRememberedAccount,
  type RememberedAccount,
} from '../services/authStorage';
import { getLoginErrorMessage } from '../utils/loginError';

const LANG_KEY = 'client-ui-language';
const LANG_EVENT = 'client-ui-language-changed';

function setClientLanguage(next: 'EN' | 'AR'): void {
  window.localStorage.setItem(LANG_KEY, next);
  window.localStorage.setItem('wms-ui-language', next);
  document.documentElement.lang = next === 'AR' ? 'ar' : 'en';
  document.documentElement.dir = next === 'AR' ? 'rtl' : 'ltr';
  window.dispatchEvent(new Event(LANG_EVENT));
  window.dispatchEvent(new Event('wms-ui-language-changed'));
}

export function LoginPage(): ReactElement {
  const { user, bootstrapped, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const initialRemembered = useMemo(() => getRememberedAccount(), []);
  const [remembered, setRemembered] = useState<RememberedAccount | null>(initialRemembered);
  const [email, setEmail] = useState(initialRemembered?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(initialRemembered));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isArabic = useClientArabic();
  useUiTheme({ storageKey: 'client-ui-theme' });

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  if (bootstrapped && user) {
    return <Navigate to={from === '/login' ? '/dashboard' : from} replace />;
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

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const me = await login(trimmedEmail, password, { persistSession: rememberFor30Days });
      if (rememberFor30Days) {
        const account: RememberedAccount = {
          email: me.email || trimmedEmail,
          displayName: me.companyName || me.fullName || me.email || trimmedEmail,
          avatarUrl: me.avatarUrl ?? null,
        };
        setRememberedAccount(account);
        setRemembered(account);
      } else {
        clearRememberedAccount();
        setRemembered(null);
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      if (/inactive|غير نشط/i.test(rawMessage)) {
        navigate('/account-inactive', { replace: true });
        return;
      }
      setError(getLoginErrorMessage(err, isArabic));
    } finally {
      setSubmitting(false);
    }
  }

  const languageToggle = (
    <button
      type="button"
      onClick={() => setClientLanguage(isArabic ? 'EN' : 'AR')}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-body shadow-sm transition-colors hover:bg-white"
    >
      <i className="fa-solid fa-globe text-brand-600" aria-hidden />
      {isArabic ? 'English' : 'العربية'}
    </button>
  );

  const rememberedForUi = remembered
    ? {
        ...remembered,
        avatarUrl: remembered.avatarUrl
          ? clientMediaSrc(remembered.avatarUrl) ?? remembered.avatarUrl
          : null,
      }
    : null;

  return (
    <div id="client-portal-root" dir={isArabic ? 'rtl' : 'ltr'}>
      <LoginScreen
        title={t('Welcome back', 'مرحبًا بعودتك')}
        subtitle={t(
          'Sign in to manage orders, COD, and inventory.',
          'سجّل الدخول لإدارة الطلبات والتحصيل والمخزون.',
        )}
        submitLabel={t('Sign in', 'تسجيل الدخول')}
        submittingLabel={t('Signing in…', 'جاري تسجيل الدخول…')}
        emailLabel={t('Email', 'البريد الإلكتروني')}
        passwordLabel={t('Password', 'كلمة المرور')}
        emailPlaceholder="you@company.com"
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
        rememberedAccount={rememberedForUi}
        onSelectRememberedAccount={selectRememberedAccount}
        onClearRememberedAccount={clearRemembered}
        bootSlot={
          !bootstrapped ? (
            <div className="flex flex-col items-center gap-3">
              <img src="/emdad-logo.png" alt="Emdad" className="h-10 w-auto object-contain" />
              {t('Loading…', 'جاري التحميل…')}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
