import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen, useUiTheme } from '@ds';
import { useAuth } from '../auth/AuthContext';
import { useClientArabic } from '../lib/client-ui-language';
import {
  getRememberedEmail,
  setRememberedEmail,
} from '../services/authStorage';
import { getLoginErrorMessage } from '../utils/loginError';

const LANG_KEY = 'client-ui-language';
const LANG_EVENT = 'client-ui-language-changed';

function setClientLanguage(next: 'EN' | 'AR'): void {
  window.localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next === 'AR' ? 'ar' : 'en';
  document.documentElement.dir = next === 'AR' ? 'rtl' : 'ltr';
  window.dispatchEvent(new Event(LANG_EVENT));
}

export function LoginPage(): ReactElement {
  const { user, bootstrapped, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const rememberedEmail = getRememberedEmail();
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isArabic = useClientArabic();
  useUiTheme({ storageKey: 'client-ui-theme' });

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  if (bootstrapped && user) {
    return <Navigate to={from === '/login' ? '/dashboard' : from} replace />;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      setRememberedEmail(rememberFor30Days ? trimmedEmail : null);
      await login(trimmedEmail, password, { persistSession: rememberFor30Days });
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
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-semibold text-text-body shadow-sm transition-colors hover:bg-surface-hover"
    >
      <i className="fa-solid fa-globe text-brand-600 dark:text-brand-400" />
      {isArabic ? 'English' : 'العربية'}
    </button>
  );

  return (
    <div id="client-portal-root" dir={isArabic ? 'rtl' : 'ltr'}>
      <LoginScreen
        brandName="EMDAD"
        title={t('Welcome back', 'مرحبًا بعودتك')}
        subtitle={t(
          'Sign in to manage orders, COD, and inventory.',
          'سجّل الدخول لإدارة الطلبات والتحصيل والمخزون.',
        )}
        heroTitle={t('Every order, one command center', 'كل طلب، في مركز تحكم واحد')}
        heroDescription={t(
          'Track orders, cash-on-delivery, and stock across every fulfillment stage in real time.',
          'تابع الطلبات والتحصيل النقدي والمخزون في كل مرحلة من مراحل التنفيذ في الوقت الفعلي.',
        )}
        submitLabel={t('Sign in', 'تسجيل الدخول')}
        submittingLabel={t('Signing in…', 'جاري تسجيل الدخول…')}
        emailLabel={t('Email', 'البريد الإلكتروني')}
        passwordLabel={t('Password', 'كلمة المرور')}
        rememberLabel={t('Remember me for 30 days', 'تذكرني لمدة 30 يومًا')}
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
