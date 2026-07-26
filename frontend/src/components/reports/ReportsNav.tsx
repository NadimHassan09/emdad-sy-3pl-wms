import { REPORT_CATALOG } from '../../lib/reports/report-catalog';
import { PillSubNav } from '../PillSubNav';

type Props = {
  isArabic?: boolean;
};

export function ReportsNav({ isArabic = false }: Props) {
  // Only report-center routes — OMS COD / Returns live under /oms/* and use their own nav.
  const items = REPORT_CATALOG.filter((entry) => entry.path.startsWith('/reports/')).map(
    (entry) => ({
      key: entry.id,
      label: isArabic ? entry.titleAr : entry.title,
      to: entry.path,
    }),
  );

  return (
    <PillSubNav
      ariaLabel={isArabic ? 'تنقل التقارير' : 'Reports navigation'}
      className="mb-0"
      items={items}
    />
  );
}
