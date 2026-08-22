import { FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen, applyUiTheme } from '@ds';
import { AuthApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
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
} from '../auth/authStorage';
import { canAccessPath, defaultHomePath } from '../lib/rbac';
import { getLoginErrorMessage } from '../lib/loginError';

const LANG_KEY = 'wms-ui-language';
const LANG_EVENT = 'wms-ui-language-changed';

function googleLoginErrorMessage(code: string | null, isArabic: boolean): string | null {
  if (!code) return null;
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  switch (code) {
    case 'google_not_linked':
      return t(
        'This Google account is not linked to an existing account. Please contact your administrator.',
        'حساب Google هذا غير مرتبط بحساب موجود. يرجى التواصل مع المسؤول.',
      );
    case 'google_inactive':
      return t(
        'This account is inactive and cannot sign in.',
        'هذا الحساب غير نشط ولا يمكن تسجيل الدخول.',
      );
    case 'google_forbidden':
      return t(
        'This account cannot access the admin system.',
        'لا يمكن لهذا الحساب الوصول إلى نظام الإدارة.',
      );
    case 'google_denied':
      return t('Google Sign-In was cancelled.', 'تم إلغاء تسجيل الدخول عبر Google.');
    case 'google_conflict':
      return t(
        'This Google account is already linked to another user.',
        'حساب Google هذا مرتبط بمستخدم آخر بالفعل.',
      );
    case 'google_unavailable':
      return t('Google Sign-In is not available right now.', 'تسجيل الدخول عبر Google غير متاح حالياً.');
    default:
      return t('Google Sign-In failed. Please try again.', 'فشل تسجيل الدخول عبر Google. حاول مرة أخرى.');
  }
}

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

function resolvePostLoginTarget(
  role: string | undefined,
  candidates: Array<string | null | undefined>,
): string {
  const home = defaultHomePath(role);
  for (const candidate of candidates) {
    if (isSafeReturnPath(candidate) && canAccessPath(role, candidate)) {
      return candidate;
    }
  }
  return home;
}

export function LoginPage() {
  const { user, booting, login, resumeSession, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const nextQuery = searchParams.get('next');
  const isArabic = useIsArabic();
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const initialRemembered = useMemo(() => getRememberedAccount(), []);
  const initialCanContinue = useMemo(
    () => Boolean(initialRemembered) && canContinueSession(),
    [initialRemembered],
  );
  const initialRememberMe = Boolean(initialRemembered) || isPersistSessionEnabled();
  const [remembered, setRemembered] = useState<RememberedAccount | null>(initialRemembered);
  const [email, setEmail] = useState(initialRemembered?.email ?? '');
  const [password, setPassword] = useState('');
  const [rememberFor30Days, setRememberFor30Days] = useState(initialRememberMe);
  const [showCredentialForm, setShowCredentialForm] = useState(!initialCanContinue);
  const [error, setError] = useState<string | null>(() =>
    googleLoginErrorMessage(searchParams.get('google_error'), isArabic),
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleCompleting, setGoogleCompleting] = useState(
    () => searchParams.get('google_auth') === 'success',
  );

  // Login pages should not follow user/browser dark-mode preferences.
  useLayoutEffect(() => {
    applyUiTheme('light', ['#admin-root', '#client-portal-root']);
  }, []);

  useEffect(() => {
    endLogoutFlow();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AuthApi.googleStatus()
      .then((s) => {
        if (!cancelled) setGoogleEnabled(Boolean(s.enabled));
      })
      .catch(() => {
        if (!cancelled) setGoogleEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const errCode = searchParams.get('google_error');
    if (errCode) {
      setError(googleLoginErrorMessage(errCode, isArabic));
      setShowCredentialForm(true);
    }
  }, [searchParams, isArabic]);

  useEffect(() => {
    if (searchParams.get('google_auth') !== 'success') return;
    let cancelled = false;
    setGoogleCompleting(true);
    setSubmitting(true);
    void (async () => {
      try {
        const persist = searchParams.get('persist') === '1';
        const refreshed = await AuthApi.refreshSession();
        setAccessToken(refreshed.access_token, persist);
        if (persist) markContinueSessionAvailable();
        const me = await AuthApi.me();
        await refresh();
        if (cancelled) return;
        if (persist && me.email) {
          const account = {
            email: me.email,
            displayName: me.fullName?.trim() || me.email,
            avatarUrl: me.avatarUrl
              ? `/api/client/media/${me.avatarUrl.replace(/^\/media\//, '').replace(/^\/+/, '')}`
              : null,
          };
          setRememberedAccount(account);
          setRemembered(account);
        }
        const stored = consumePostLoginReturnTo();
        const target = resolvePostLoginTarget(me.role, [fromState, nextQuery, stored]);
        navigate(target, { replace: true });
      } catch {
        if (!cancelled) {
          setGoogleCompleting(false);
          setError(
            isArabic
              ? 'اكتمل تسجيل Google لكن استعادة الجلسة فشلت. حاول مرة أخرى.'
              : 'Google Sign-In completed but session restore failed. Please try again.',
          );
          setShowCredentialForm(true);
        }
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refresh, navigate, fromState, nextQuery, isArabic]);

  if (booting || googleCompleting) {
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
              {googleCompleting
                ? t('Signing in with Google…', 'جاري تسجيل الدخول عبر Google…')
                : t('Loading…', 'جاري التحميل…')}
            </div>
          }
        />
      </div>
    );
  }

  if (user) {
    const stored = consumePostLoginReturnTo();
    const target = resolvePostLoginTarget(user.role, [fromState, nextQuery, stored]);
    return <Navigate to={target} replace />;
  }

  async function clearRemembered() {
    try {
      await AuthApi.logout({ soft: false });
    } catch {
      /* ignore */
    }
    clearRememberedAccount();
    clearContinueSession();
    clearAccessToken();
    setRemembered(null);
    setEmail('');
    setPassword('');
    setRememberFor30Days(false);
    setShowCredentialForm(true);
    setError(null);
  }

  async function selectRememberedAccount() {
    if (!remembered) return;
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await resumeSession();
      const stored = consumePostLoginReturnTo();
      const target = resolvePostLoginTarget(loggedIn.role, [fromState, nextQuery, stored]);
      navigate(target, { replace: true });
    } catch {
      clearContinueSession();
      clearAccessToken({ keepPersist: true });
      setEmail(remembered.email);
      setRememberFor30Days(true);
      setShowCredentialForm(true);
      setError(
        t(
          'Your saved session expired. Enter your password to continue.',
          'انتهت الجلسة المحفوظة. أدخل كلمة المرور للمتابعة.',
        ),
      );
      window.setTimeout(() => {
        document.getElementById('login-password')?.focus();
      }, 0);
    } finally {
      setSubmitting(false);
    }
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
        markContinueSessionAvailable();
        const account = {
          email: loggedIn.email || trimmedEmail,
          displayName: loggedIn.fullName || loggedIn.email || trimmedEmail,
        };
        setRememberedAccount(account);
        setRemembered(account);
      } else {
        clearRememberedAccount();
        clearContinueSession();
        setRemembered(null);
      }
      const stored = consumePostLoginReturnTo();
      const target = resolvePostLoginTarget(loggedIn.role, [fromState, nextQuery, stored]);
      navigate(target, { replace: true });
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err, isArabic));
    } finally {
      setSubmitting(false);
    }
  }

  const offerContinue = Boolean(remembered && canContinueSession() && !showCredentialForm);
  const hideCredentialForm = offerContinue;

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

  const googleOAuthSlot = googleEnabled ? (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-text-faint">
        <span className="h-px flex-1 bg-border" />
        {t('OR', 'أو')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          window.location.assign(AuthApi.googleLoginUrl({ rememberMe: rememberFor30Days }));
        }}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-white text-sm font-semibold text-text-strong shadow-sm transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z"
          />
          <path
            fill="#34A853"
            d="M6.6 14.3l-.5.4-2.2 1.7C5.5 19.2 8.5 21 12 21c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.4z"
          />
          <path
            fill="#4A90E2"
            d="M4 9c-.6 1.1-.9 2.3-.9 3.6s.3 2.5.9 3.6c0 .1 2.7-2.1 2.7-2.1-.2-.5-.3-1-.3-1.5s.1-1 .3-1.5L4 9z"
          />
          <path
            fill="#FBBC05"
            d="M12 4.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 1.7 14.4 1 12 1 8.5 1 5.5 2.8 4 5.7L6.7 7.8C7.9 5.9 9.8 4.5 12 4.5z"
          />
        </svg>
        {t('Sign in with Google', 'تسجيل الدخول عبر Google')}
      </button>
    </div>
  ) : null;

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
        continueLabel={t('Continue', 'متابعة')}
        orLabel={t('OR', 'أو')}
        showCredentialFormLabel={t('Not you ?', 'لست أنت؟')}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={onSubmit}
        loading={submitting}
        error={error}
        remember={rememberFor30Days}
        onRememberChange={(next) => {
          setRememberFor30Days(next);
          if (!next) setShowCredentialForm(true);
        }}
        hideCredentialForm={hideCredentialForm}
        onShowCredentialForm={() => {
          setShowCredentialForm(true);
          setError(null);
        }}
        cornerSlot={languageToggle}
        rememberedAccount={remembered}
        onSelectRememberedAccount={() => void selectRememberedAccount()}
        onClearRememberedAccount={() => void clearRemembered()}
        oauthSlot={hideCredentialForm ? null : googleOAuthSlot}
      />
    </div>
  );
}
