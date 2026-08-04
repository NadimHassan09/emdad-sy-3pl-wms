import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useUiTheme } from '@ds';
import { CopyEmailButton } from '../components/CopyEmailButton';

export function AccountStatusPage(): ReactElement {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('client-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  useUiTheme({ storageKey: 'client-ui-theme' });

  return (
    <div
      id="client-portal-root"
      dir={isArabic ? 'rtl' : 'ltr'}
      className="flex min-h-dvh items-center justify-center bg-[var(--surface-page)] p-4 sm:p-6"
    >
      <div className="w-full max-w-[440px] rounded-3xl border border-border bg-surface-card p-8 text-center shadow-xl sm:p-10">
        <div className="mb-5 flex justify-center">
          <img src="/emdad-logo.png" alt="Emdad" className="h-10 w-auto object-contain" />
        </div>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-fg">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-text-strong">
          {t('Your account is inactive', 'حسابك غير نشط حاليا')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          {t(
            'Access to this portal has been temporarily disabled. This usually happens when an account is suspended or archived. Your historical data is safe.',
            'تم تعطيل الوصول إلى هذه البوابة مؤقتا. يحدث هذا عادة عند إيقاف الحساب أو أرشفته. بياناتك السابقة محفوظة بأمان.',
          )}
        </p>
        <p className="mt-4 text-sm font-medium text-text-body">
          {t('Please contact support to restore access.', 'يرجى التواصل مع الدعم لاستعادة الوصول.')}
        </p>

        <CopyEmailButton
          copyText="support@emdadsy.com"
          copiedLabel={t('Copied', 'تم النسخ')}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-cta bg-cta px-3.5 py-3 text-sm font-semibold text-white shadow-xs transition-[colors,transform] duration-fast hover:border-cta-hover hover:bg-cta-hover active:scale-[0.97] cursor-pointer"
        >
          <i className="fa-solid fa-envelope text-sm" aria-hidden="true" />
          {t('Contact support', 'تواصل مع الدعم')}
        </CopyEmailButton>

        <Link
          to="/login"
          className="mt-4 inline-block text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
        >
          {t('Back to login', 'العودة لتسجيل الدخول')}
        </Link>
      </div>
    </div>
  );
}

export default AccountStatusPage;
