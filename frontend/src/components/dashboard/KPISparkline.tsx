import { useId } from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export function KPISparkline({
  data,
  color = 'var(--color-brand-500)',
}: {
  data: Array<{ value: number }>;
  color?: string;
}) {
  const uid = useId().replace(/:/g, '');
  if (data.length < 2) return null;
  const id = `kpi-spark-${uid}`;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
