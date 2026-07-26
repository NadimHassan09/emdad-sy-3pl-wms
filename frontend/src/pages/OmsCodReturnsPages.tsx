import { ReportWorkspace } from '../components/reports/ReportWorkspace';
import { PageHeader } from '../components/PageHeader';

function useIsArabic(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.localStorage.getItem('wms-ui-language') === 'AR' ||
    document.documentElement.dir === 'rtl'
  );
}

/** Standalone OMS COD page — not under Reporting Center. */
export function OmsCodPage() {
  const isArabic = useIsArabic();
  return (
    <div className="space-y-4">
      <PageHeader
        title={isArabic ? 'الدفع عند الاستلام' : 'COD'}
        description={
          isArabic
            ? 'طلبات الدفع عند الاستلام مع حالة التحصيل والتسوية'
            : 'COD orders with collection and settlement status'
        }
      />
      <ReportWorkspace reportId="cod-report" isArabic={isArabic} />
    </div>
  );
}

/** Standalone OMS returns page — not under Reporting Center. */
export function OmsReturnsPage() {
  const isArabic = useIsArabic();
  return (
    <div className="space-y-4">
      <PageHeader
        title={isArabic ? 'مرتجعات OMS' : 'OMS Returns'}
        description={
          isArabic
            ? 'طلبات OMS المرتجعة مع بيانات المستلم والدفع عند الاستلام'
            : 'Returned OMS orders with recipient and COD details'
        }
      />
      <ReportWorkspace reportId="returns-report" isArabic={isArabic} />
    </div>
  );
}
