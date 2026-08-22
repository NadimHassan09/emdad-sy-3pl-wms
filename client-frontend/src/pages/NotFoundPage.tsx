import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@ds';

import { usePageTitle } from '../hooks/usePageTitle';
import { isClientArabic } from '../lib/client-ui-language';

export function NotFoundPage(): ReactElement {
  const isArabic = isClientArabic();
  usePageTitle(isArabic ? 'الصفحة غير موجودة' : 'Page not found', isArabic);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-6 shadow-sm sm:p-8">
        <EmptyState
          icon={<i className="fa-solid fa-compass text-2xl" aria-hidden="true" />}
          title={isArabic ? 'الصفحة غير موجودة' : 'Page not found'}
          description={
            isArabic
              ? 'هذا الرابط غير موجود في بوابة العميل. عد إلى لوحة التحكم أو استخدم القائمة الجانبية.'
              : 'This link is not part of the Client Portal. Return to the dashboard or use the sidebar.'
          }
          action={
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-on-brand bg-cta hover:bg-cta-hover transition-colors no-underline"
            >
              {isArabic ? 'العودة إلى لوحة التحكم' : 'Back to dashboard'}
            </Link>
          }
        />
      </div>
    </div>
  );
}
