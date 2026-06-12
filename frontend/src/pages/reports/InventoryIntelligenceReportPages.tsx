import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';

type OutletContext = { isArabic?: boolean };

function inventoryIntelligencePage(reportId: ReportCatalogId) {
  return function InventoryIntelligenceReportPage() {
    const ctx = useOutletContext<OutletContext>();
    return <ReportWorkspace reportId={reportId} isArabic={ctx?.isArabic} />;
  };
}

export const StockAgingReportPage = inventoryIntelligencePage('stock-aging');
export const LotExpiryReportPage = inventoryIntelligencePage('lot-expiry');
export const CapacityUtilizationReportPage = inventoryIntelligencePage('capacity-utilization');
export const ReturnRateReportPage = inventoryIntelligencePage('return-rate');
