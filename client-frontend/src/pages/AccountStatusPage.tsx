import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function AccountStatusPage(): ReactElement {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('client-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {t('Your account is inactive', 'حسابك غير نشط حاليا')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t(
            'Access to this portal has been temporarily disabled. This usually happens when an account is suspended or archived. Your historical data is safe.',
            'تم تعطيل الوصول إلى هذه البوابة مؤقتا. يحدث هذا عادة عند إيقاف الحساب أو أرشفته. بياناتك السابقة محفوظة بأمان.',
          )}
        </p>
        <p className="mt-4 text-sm font-medium text-slate-700">
          {t('Please contact support to restore access.', 'يرجى التواصل مع الدعم لاستعادة الوصول.')}
        </p>
        <a
          href="mailto:support@emdadsy.com"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          {t('Contact support', 'تواصل مع الدعم')}
        </a>
        <Link
          to="/login"
          className="mt-3 inline-block text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          {t('Back to login', 'العودة لتسجيل الدخول')}
        </Link>
      </div>
    </div>
  );
}

export default AccountStatusPage;
