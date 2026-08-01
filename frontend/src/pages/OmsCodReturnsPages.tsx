import { ReportWorkspace } from '../components/reports/ReportWorkspace';
import { AdminListPageShell } from '../components/AdminListPageShell';

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
    <AdminListPageShell
      icon="fa-money-bill"
      title={isArabic ? 'الدفع عند الاستلام' : 'COD'}
      subtitle={
        isArabic
          ? 'طلبات الدفع عند الاستلام مع حالة التحصيل والتسوية'
          : 'COD orders with collection and settlement status'
      }
      isArabic={isArabic}
      showSectionNav
    >
      <ReportWorkspace reportId="cod-report" isArabic={isArabic} />
    </AdminListPageShell>
  );
}

/** Standalone OMS returns page — not under Reporting Center. */
export function OmsReturnsPage() {
  const isArabic = useIsArabic();
  return (
    <AdminListPageShell
      icon="fa-rotate-left"
      title={isArabic ? 'مرتجعات OMS' : 'OMS Returns'}
      subtitle={
        isArabic
          ? 'طلبات OMS المرتجعة مع بيانات المستلم والدفع عند الاستلام'
          : 'Returned OMS orders with recipient and COD details'
      }
      isArabic={isArabic}
      showSectionNav
    >
      <ReportWorkspace reportId="returns-report" isArabic={isArabic} />
    </AdminListPageShell>
  );
}
