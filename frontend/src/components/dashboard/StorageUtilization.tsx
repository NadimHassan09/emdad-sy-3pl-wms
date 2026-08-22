import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

import type { Warehouse } from '../../api/warehouses';

import { dashboardLabel } from './dashboard-i18n';
import { cbmNumber, numberFmt, percentFmt } from './dashboard-utils';
import { DashboardWidget, WidgetEmpty, WidgetLink } from './DashboardWidget';

const USED = 'var(--color-brand-500)';
const AVAILABLE = 'var(--color-neutral-200)';
const RESERVED = 'var(--color-warning-500)';

export function StorageUtilization({
  usedCbm,
  reservedCbm,
  remainingCbm,
  percent,
  warehouses,
  canOpenWarehouses,
  isArabic,
}: {
  usedCbm: string | number;
  reservedCbm: string | number;
  remainingCbm: string | number;
  percent: number;
  warehouses: Warehouse[];
  canOpenWarehouses: boolean;
  isArabic: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const used = cbmNumber(usedCbm);
  const reserved = cbmNumber(reservedCbm);
  const remaining = Math.max(0, cbmNumber(remainingCbm));
  const slices = [
    { key: 'used', name: t('Used'), value: used, color: USED },
    { key: 'available', name: t('Available'), value: remaining, color: AVAILABLE },
    { key: 'reserved', name: t('Reserved'), value: Math.max(0, reserved - used), color: RESERVED },
  ].filter((s) => s.value > 0);

  const empty = used === 0 && remaining === 0 && reserved === 0;

  return (
    <DashboardWidget
      title={t('Storage Utilization')}
      action={<WidgetLink to="/billing/plans">{t('View all')}</WidgetLink>}
    >
      {empty ? (
        <WidgetEmpty>{t('No storage data.')}</WidgetEmpty>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative h-[120px] w-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices.length ? slices : [{ key: 'empty', value: 1, color: AVAILABLE }]}
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={56}
                    stroke="none"
                    paddingAngle={1}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {(slices.length ? slices : [{ color: AVAILABLE }]).map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-text-strong">
                  {percentFmt(percent)}
                </span>
                <span className="text-[10px] font-medium text-text-muted">{t('Used')}</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-xs">
              {[
                { label: t('Used'), value: used, color: USED },
                { label: t('Available'), value: remaining, color: 'var(--color-neutral-400)' },
                { label: t('Reserved'), value: reserved, color: RESERVED },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="tabular-nums font-semibold text-text-strong">
                    {numberFmt(Number(row.value.toFixed(1)))} {t('CBM')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {warehouses.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-text-muted">{t('Top Warehouses')}</p>
              <ul className="space-y-2">
                {warehouses.slice(0, 4).map((w) => {
                  const inner = (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-text-body">{w.name}</span>
                      <span className="shrink-0 tabular-nums text-text-faint">{w.code}</span>
                    </div>
                  );
                  return (
                    <li key={w.id}>
                      {canOpenWarehouses ? (
                        <Link to="/warehouses" className="block rounded-md px-0.5 py-0.5 hover:bg-surface-hover">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </DashboardWidget>
  );
}
