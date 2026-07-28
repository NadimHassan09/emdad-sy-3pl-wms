import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { isClientArabic } from '../lib/client-ui-language';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isArabic = isClientArabic();

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  if (bootstrapped && user) {
    return <Navigate to={from === '/login' ? '/dashboard' : from} replace />;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
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
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
            <i className="fa-solid fa-warehouse text-white" />
          </div>
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
      <div className="flex min-h-dvh">
        {/* Brand panel — matches portal sidebar chrome */}
        <aside className="relative hidden lg:flex w-[42%] xl:w-[40%] flex-col justify-between overflow-hidden bg-slate-950 text-white p-10 xl:p-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(16,185,129,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 90%, rgba(5,150,105,0.22), transparent 50%)',
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <i className="fa-solid fa-warehouse text-white" />
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight text-slate-100">EMDAD</div>
                <div className="text-xs text-slate-400 font-medium">
                  {t('Client Portal', 'بوابة العملاء')}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 space-y-8 my-auto py-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight">
                {t('Run your online business from one place', 'أدِر أعمالك الإلكترونية من مكان واحد')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 max-w-sm">
                {t(
                  'Track orders, COD collections, and inventory with the same premium experience you use inside the portal.',
                  'تتبّع الطلبات وتحصيل الدفع عند الاستلام والمخزون بنفس التجربة الاحترافية داخل البوابة.',
                )}
              </p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  icon: 'fa-bag-shopping',
                  title: t('Orders & fulfillment', 'الطلبات والتنفيذ'),
                  body: t("See every order status at a glance", "اطلع على حالة كل طلب بنظرة"),
                },
                {
                  icon: 'fa-money-bill-wave',
                  title: t('COD & payouts', 'التحصيل والتحويلات'),
                  body: t('Know what is ready to withdraw', 'اعرف ما هو جاهز للسحب'),
                },
                {
                  icon: 'fa-boxes-stacked',
                  title: t('Live inventory', 'المخزون الحالي'),
                  body: t('Spot low stock before it hurts sales', 'اكتشف انخفاض المخزون قبل أن يؤثر على المبيعات'),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <i className={`fa-solid ${item.icon} text-emerald-400 text-sm`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-500">
            © {new Date().getFullYear()} Emdad · {t('Merchant portal', 'بوابة التجار')}
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex-1 flex flex-col relative">
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

          <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-[420px] animate-enter">
              {/* Mobile brand */}
              <div className="lg:hidden flex items-center gap-3 mb-8">
                <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <i className="fa-solid fa-warehouse text-white text-sm" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 tracking-tight">EMDAD</div>
                  <div className="text-xs text-slate-500">{t('Client Portal', 'بوابة العملاء')}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-elevated p-7 sm:p-8">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-semibold mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t('Secure sign-in', 'تسجيل دخول آمن')}
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
                        aria-label={showPassword ? t('Hide password', 'إخفاء كلمة المرور') : t('Show password', 'إظهار كلمة المرور')}
                      >
                        <i className={`text-sm fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>
                    </div>
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

                <p className="mt-6 text-center text-xs text-slate-400">
                  {t('Need help?', 'تحتاج مساعدة؟')}{' '}
                  <a
                    href="mailto:support@emdadsy.com"
                    className="font-semibold text-emerald-600 hover:text-emerald-700 no-underline"
                  >
                    {t('Contact support', 'تواصل مع الدعم')}
                  </a>
                </p>
              </div>

              <p className="mt-6 text-center text-[11px] text-slate-400 lg:hidden">
                © {new Date().getFullYear()} Emdad
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
