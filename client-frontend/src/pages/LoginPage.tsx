import type { FormEvent, ReactElement } from 'react';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen, applyUiTheme } from '@ds';
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
import { apiClient } from '../services/apiClient';

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

type ResetStep = 'email' | 'code' | 'done';

function ForgotPasswordModal({
  onClose,
  isArabic,
}: {
  onClose: () => void;
  isArabic: boolean;
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/request-reset', { email: email.trim() });
      setStep('code');
    } catch {
      setError(t('Failed to send reset code. Please try again.', 'تعذّر إرسال رمز إعادة التعيين. حاول مجدداً.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('Passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('Password must be at least 8 characters.', 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/expired/i.test(msg)) {
        setError(t('Code has expired. Please request a new one.', 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.'));
      } else {
        setError(t('Invalid or expired code.', 'الرمز غير صحيح أو منتهي الصلاحية.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('Reset Password', 'إعادة تعيين كلمة المرور')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'done' ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {t('Password updated successfully. You can now sign in with your new password.', 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {t('Back to Sign In', 'العودة لتسجيل الدخول')}
            </button>
          </div>
        ) : step === 'email' ? (
          <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
            <p className="text-sm text-gray-500">
              {t(
                'Enter your email address and we\'ll send you a 6-digit reset code.',
                'أدخل بريدك الإلكتروني وسنرسل لك رمز إعادة التعيين المكوّن من 6 أرقام.',
              )}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('Email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {loading ? t('Sending…', 'جاري الإرسال…') : t('Send Reset Code', 'إرسال رمز إعادة التعيين')}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void submitReset(e)} className="space-y-4">
            <p className="text-sm text-gray-500">
              {t(
                `A 6-digit code was sent to ${email}. Enter it below along with your new password.`,
                `تم إرسال رمز مكوّن من 6 أرقام إلى ${email}. أدخله أدناه مع كلمة المرور الجديدة.`,
              )}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('Reset Code', 'رمز إعادة التعيين')}
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('New Password', 'كلمة المرور الجديدة')}
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('Confirm Password', 'تأكيد كلمة المرور')}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(null); }}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('Back', 'رجوع')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {loading ? t('Saving…', 'جاري الحفظ…') : t('Reset Password', 'إعادة تعيين')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function LoginPage(): ReactElement {
  const { user, bootstrapped, login, resumeSession } = useAuth();
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
  const [showForgot, setShowForgot] = useState(false);
  const isArabic = useClientArabic();
  // Login pages should not follow user/browser dark-mode preferences.
  // Force light theme to keep the login UI consistent on every environment.
  useLayoutEffect(() => {
    applyUiTheme('light', ['#client-portal-root', '#admin-root']);
  }, []);

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

  async function selectRememberedAccount(): Promise<void> {
    if (!remembered) return;
    setError(null);
    setSubmitting(true);
    try {
      await resumeSession();
      navigate(from === '/login' ? '/dashboard' : from, { replace: true });
    } catch {
      // No live session (e.g. after logout) — fall through to password entry quietly.
      setEmail(remembered.email);
      setRememberFor30Days(true);
      setError(null);
      window.setTimeout(() => {
        document.getElementById('login-password')?.focus();
      }, 0);
    } finally {
      setSubmitting(false);
    }
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

  const forgotPasswordSlot = (
    <div className="pt-1 text-center">
      <button
        type="button"
        onClick={() => setShowForgot(true)}
        className="text-xs text-brand-600 hover:underline"
      >
        {t('Forgot password?', 'نسيت كلمة المرور؟')}
      </button>
    </div>
  );

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
        continueLabel={t('Continue', 'متابعة')}
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
        onSelectRememberedAccount={() => void selectRememberedAccount()}
        onClearRememberedAccount={clearRemembered}
        oauthSlot={forgotPasswordSlot}
        bootSlot={
          !bootstrapped ? (
            <div className="flex flex-col items-center gap-3">
              <img src="/emdad-logo.png" alt="Emdad" className="h-10 w-auto object-contain" />
              {t('Loading…', 'جاري التحميل…')}
            </div>
          ) : undefined
        }
      />
      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} isArabic={isArabic} />
      )}
    </div>
  );
}
