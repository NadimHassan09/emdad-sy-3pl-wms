import { Navigate } from 'react-router-dom';

import { DEFAULT_REPORT_PATH } from '../lib/reports/report-catalog';

/** Legacy route — redirects to nested reports layout. */
export function ReportsPage() {
  return <Navigate to={DEFAULT_REPORT_PATH} replace />;
}
