import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';

type OutletContext = { isArabic?: boolean };

export function WarehouseAnalysisReportPage() {
  const ctx = useOutletContext<OutletContext>();
  return <ReportWorkspace reportId="warehouse-analysis" isArabic={ctx?.isArabic} />;
}
