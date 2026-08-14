import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';

import { dashboardLabel } from './dashboard-i18n';
import { numberFmt } from './dashboard-utils';
import { DashboardWidget, WidgetEmpty, WidgetError, WidgetLink } from './DashboardWidget';

export type TopProductRow = {
  productId: string;
  name: string;
  sku?: string;
  moves: number;
  imageSrc?: string | null;
};

export function TopProducts({
  rows,
  isArabic,
  isError,
  onRetry,
}: {
  rows: TopProductRow[];
  isArabic: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const max = Math.max(...rows.map((r) => r.moves), 1);

  return (
    <DashboardWidget
      title={t('Top Products by Movement')}
      action={<WidgetLink to="/reports/product-moves">{t('View all')}</WidgetLink>}
    >
      {isError ? (
        <WidgetError
          message={t('Unable to load this data.')}
          retryLabel={t('Try again')}
          onRetry={onRetry ?? (() => undefined)}
        />
      ) : rows.length === 0 ? (
        <WidgetEmpty>{t('No product movement yet.')}</WidgetEmpty>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 5).map((row) => (
            <li key={row.productId}>
              <Link to={`/inventory/product/${row.productId}`} className="block">
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken text-text-faint">
                    {row.imageSrc ? (
                      <img src={row.imageSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-strong">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                    {numberFmt(row.moves)} {t('moves')}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.max(8, (row.moves / max) * 100)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}
