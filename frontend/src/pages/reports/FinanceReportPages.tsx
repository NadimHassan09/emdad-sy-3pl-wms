import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';

type OutletContext = { isArabic?: boolean };

function financePage(reportId: ReportCatalogId) {
  return function FinanceReportPage() {
    const ctx = useOutletContext<OutletContext>();
    return <ReportWorkspace reportId={reportId} isArabic={ctx?.isArabic} />;
  };
}

export const RevenueByClientReportPage = financePage('revenue-by-client');
export const ReceivablesAgingReportPage = financePage('receivables-aging');
