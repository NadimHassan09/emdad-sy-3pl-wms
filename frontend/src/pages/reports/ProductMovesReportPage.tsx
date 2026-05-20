import { useOutletContext } from 'react-router-dom';

import { ReportWorkspace } from '../../components/reports/ReportWorkspace';

type OutletContext = { isArabic?: boolean };

export function ProductMovesReportPage() {
  const ctx = useOutletContext<OutletContext>();
  return <ReportWorkspace reportId="product-moves" isArabic={ctx?.isArabic} />;
}
