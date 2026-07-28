import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { usePageTitle } from '../hooks/usePageTitle';
import { isClientArabic } from '../lib/client-ui-language';

export function NotFoundPage(): ReactElement {
  const isArabic = isClientArabic();
  usePageTitle(isArabic ? 'الصفحة غير موجودة' : 'Page not found', isArabic);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 text-center">
        <span
          aria-hidden="true"
          className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
        >
          <i className="fa-solid fa-compass text-2xl" />
        </span>
        <h1 className="text-base font-semibold text-slate-900 m-0">
          {isArabic ? 'الصفحة غير موجودة' : 'Page not found'}
        </h1>
        <p className="mt-2 text-sm text-slate-500 m-0">
          {isArabic
            ? 'هذا الرابط غير موجود في بوابة العميل. عد إلى لوحة التحكم أو استخدم القائمة الجانبية.'
            : 'This link is not part of the Client Portal. Return to the dashboard or use the sidebar.'}
        </p>
        <div className="mt-4 flex justify-center">
          <Link to="/dashboard" className="btn btn--primary">
            {isArabic ? 'العودة إلى لوحة التحكم' : 'Back to dashboard'}
          </Link>
        </div>
      </div>
    </div>
  );
}
