import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';

type OutletContext = { isArabic?: boolean };

function operationalPage(reportId: ReportCatalogId) {
  return function OperationalReportPage() {
    const ctx = useOutletContext<OutletContext>();
    return <ReportWorkspace reportId={reportId} isArabic={ctx?.isArabic} />;
  };
}

export const WorkerProductivityReportPage = operationalPage('worker-productivity');
export const OrderCycleTimeReportPage = operationalPage('order-cycle-time');
export const InboundAccuracyReportPage = operationalPage('inbound-accuracy');
export const OutboundFillRateReportPage = operationalPage('outbound-fill-rate');
export const SlaComplianceReportPage = operationalPage('sla-compliance');
