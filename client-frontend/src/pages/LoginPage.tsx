import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberFor30Days, setRememberFor30Days] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isArabic = useClientArabic();

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

  if (!bootstrapped) {
    return (
      <div
        id="client-portal-root"
        dir={isArabic ? 'rtl' : 'ltr'}
        className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"
      >
        <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
          <img src="/emdad-logo.png" alt="Emdad" className="h-10 w-auto object-contain" />
          {t('Loading…', 'جاري التحميل…')}
        </div>
      </div>
    );
  }

  return (
    <div
      id="client-portal-root"
      dir={isArabic ? 'rtl' : 'ltr'}
      className="min-h-dvh bg-slate-50 text-slate-900 antialiased"
    >
      <div className="absolute top-4 end-4 z-10">
        <button
          type="button"
          onClick={() => setClientLanguage(isArabic ? 'EN' : 'AR')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-soft transition-colors"
        >
          <i className="fa-solid fa-globe text-emerald-600" />
          {isArabic ? 'English' : 'العربية'}
        </button>
      </div>

      <main className="flex min-h-dvh items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px] animate-enter">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-elevated p-7 sm:p-8">
            <div className="mb-6 text-center">
              <div className="mb-4 flex justify-center">
                <img
                  src="/emdad-logo.png"
                  alt="Emdad"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {t('Welcome back', 'مرحبًا بعودتك')}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {t(
                  'Sign in to manage orders, COD, and inventory.',
                  'سجّل الدخول لإدارة الطلبات والتحصيل والمخزون.',
                )}
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {t('Email', 'البريد الإلكتروني')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('you@company.com', 'you@company.com')}
                    className="input-premium w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 ps-10 pe-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {t('Password', 'كلمة المرور')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-premium w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 ps-10 pe-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label={
                      showPassword
                        ? t('Hide password', 'إخفاء كلمة المرور')
                        : t('Show password', 'إظهار كلمة المرور')
                    }
                  >
                    <i className={`text-sm fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rememberFor30Days}
                  onClick={() => setRememberFor30Days((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    rememberFor30Days ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      rememberFor30Days ? 'start-[1.375rem]' : 'start-0.5'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setRememberFor30Days((v) => !v)}
                  className="text-sm font-medium text-slate-700 text-start"
                >
                  {t('Remember me for 30 days', 'تذكرني لمدة 30 يومًا')}
                </button>
              </div>

              {error ? (
                <div
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 flex items-start gap-2"
                  role="alert"
                >
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
              >
                {submitting
                  ? t('Signing in…', 'جاري تسجيل الدخول…')
                  : t('Sign in', 'تسجيل الدخول')}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
