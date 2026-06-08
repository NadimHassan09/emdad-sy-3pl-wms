import { REPORT_CATALOG } from '../../lib/reports/report-catalog';
import { PillSubNav } from '../PillSubNav';

type Props = {
  isArabic?: boolean;
};

export function ReportsNav({ isArabic = false }: Props) {
  return (
    <PillSubNav
      ariaLabel={isArabic ? 'تنقل التقارير' : 'Reports navigation'}
      className="mb-0"
      items={REPORT_CATALOG.map((entry) => ({
        key: entry.id,
        label: isArabic ? entry.titleAr : entry.title,
        to: entry.path,
      }))}
    />
  );
}
