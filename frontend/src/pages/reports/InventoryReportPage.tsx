import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';

type OutletContext = { isArabic?: boolean };

export function InventoryReportPage() {
  const ctx = useOutletContext<OutletContext>();
  return <ReportWorkspace reportId="inventory" isArabic={ctx?.isArabic} />;
}
