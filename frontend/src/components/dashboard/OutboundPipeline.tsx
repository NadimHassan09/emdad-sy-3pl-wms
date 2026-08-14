import { Link } from 'react-router-dom';

import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { numberFmt } from './dashboard-utils';
import { DashboardWidget, WidgetEmpty, WidgetLink } from './DashboardWidget';

export type PipelineStage = {
  key: string;
  label: string;
  count: number;
  to: string;
  tone: 'amber' | 'blue' | 'purple' | 'green';
};

const TONE: Record<PipelineStage['tone'], { bg: string; bar: string; text: string }> = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    bar: 'bg-amber-500',
    text: 'text-amber-800 dark:text-amber-300',
  },
  blue: {
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    bar: 'bg-sky-500',
    text: 'text-sky-800 dark:text-sky-300',
  },
  purple: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    bar: 'bg-violet-500',
    text: 'text-violet-800 dark:text-violet-300',
  },
  green: {
    bg: 'bg-brand-50 dark:bg-brand-950/30',
    bar: 'bg-brand-500',
    text: 'text-brand-800 dark:text-brand-300',
  },
};

export function OutboundPipeline({
  stages,
  isArabic,
}: {
  stages: PipelineStage[];
  isArabic: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const total = stages.reduce((s, x) => s + x.count, 0);

  return (
    <DashboardWidget
      title={t('Outbound Pipeline')}
      action={<WidgetLink to="/orders/outbound">{t('View all')}</WidgetLink>}
    >
      {total === 0 ? (
        <WidgetEmpty>{t('No open orders')}</WidgetEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stages.map((stage, i) => {
            const tone = TONE[stage.tone];
            const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
            return (
              <Link
                key={stage.key}
                to={stage.to}
                className={cn(
                  'relative min-w-0 rounded-[10px] px-3 py-3 transition-transform hover:-translate-y-0.5',
                  tone.bg,
                  i < stages.length - 1 &&
                    "after:pointer-events-none after:absolute after:end-[-6px] after:top-1/2 after:z-10 after:hidden after:h-3 after:w-3 after:-translate-y-1/2 after:rotate-45 after:bg-inherit sm:after:block rtl:after:-rotate-45",
                )}
              >
                <p className={cn('text-[11px] font-semibold', tone.text)}>{t(stage.label)}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-strong">
                  {numberFmt(stage.count)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', tone.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular-nums text-text-faint">{pct}%</p>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
