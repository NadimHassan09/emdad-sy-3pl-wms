import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';

type OutletContext = { isArabic?: boolean };

function omsPage(reportId: ReportCatalogId) {
  return function OmsReportPage() {
    const ctx = useOutletContext<OutletContext>();
    return <ReportWorkspace reportId={reportId} isArabic={ctx?.isArabic} />;
  };
}

export const CodReportPage = omsPage('cod-report');
export const MerchantOrdersReportPage = omsPage('merchant-orders');
export const SalesReportPage = omsPage('sales-report');
export const ReturnsReportPage = omsPage('returns-report');
export const DeliveryReportPage = omsPage('delivery-report');
export const AllocationReportPage = omsPage('allocation-report');
export const InventoryReservedReportPage = omsPage('inventory-reserved');
