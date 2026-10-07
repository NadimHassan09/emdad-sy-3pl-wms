import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Direction } from 'radix-ui'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@ui/components/ui/chart'
import { cn } from '@ui/lib/utils'

/** Default categorical series, in order. Values come from tokens.css (light + dark). */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const

export type Series = { key: string; label: string; color?: string }

function buildConfig(series: Series[]): ChartConfig {
  return Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }]))
}

type CommonProps = {
  data: Record<string, string | number | null>[]
  xKey: string
  series: Series[]
  className?: string
  height?: number
  legend?: boolean
  /** Format the X tick label */
  xFormatter?: (v: string | number) => string
  /** Format Y tick / tooltip number */
  yFormatter?: (v: number) => string
}

/** In RTL the X axis is mirrored and the Y axis moves to the opposite side. */
function useAxisProps() {
  const rtl = Direction.useDirection() === 'rtl'
  return {
    x: { reversed: rtl } as const,
    y: { orientation: (rtl ? 'right' : 'left') as 'left' | 'right' },
  }
}

export function AreaSeriesChart({ data, xKey, series, className, height = 260, legend = true, xFormatter, yFormatter }: CommonProps) {
  const cfg = buildConfig(series)
  const ax = useAxisProps()
  return (
    <ChartContainer config={cfg} className={cn('w-full', className)} style={{ height }}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={xFormatter} {...ax.x} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={yFormatter} allowDecimals={false} {...ax.y} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {series.map((s) => (
          <Area key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} fill={`var(--color-${s.key})`} fillOpacity={0.15} strokeWidth={2} />
        ))}
        {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </AreaChart>
    </ChartContainer>
  )
}

export function BarSeriesChart({
  data, xKey, series, className, height = 260, legend = true, xFormatter, yFormatter, stacked,
}: CommonProps & { stacked?: boolean }) {
  const cfg = buildConfig(series)
  const ax = useAxisProps()
  return (
    <ChartContainer config={cfg} className={cn('w-full', className)} style={{ height }}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={xFormatter} {...ax.x} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={yFormatter} allowDecimals={false} {...ax.y} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={stacked ? 0 : 4} stackId={stacked ? 'a' : undefined} maxBarSize={36} />
        ))}
        {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </BarChart>
    </ChartContainer>
  )
}

export function LineSeriesChart({ data, xKey, series, className, height = 260, legend = true, xFormatter, yFormatter }: CommonProps) {
  const cfg = buildConfig(series)
  const ax = useAxisProps()
  return (
    <ChartContainer config={cfg} className={cn('w-full', className)} style={{ height }}>
      <LineChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={xFormatter} {...ax.x} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={yFormatter} allowDecimals={false} {...ax.y} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />
        ))}
        {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </LineChart>
    </ChartContainer>
  )
}

export type DonutDatum = { key: string; label: string; value: number; color?: string }

/** Donut with centred total. Legend rendered outside (HTML) so labels stay readable & RTL-safe. */
export function DonutChart({
  data, className, size = 180, centerValue, centerLabel,
}: {
  data: DonutDatum[]
  className?: string
  size?: number
  centerValue?: string
  centerLabel?: string
}) {
  const cfg = buildConfig(data.map((d) => ({ key: d.key, label: d.label, color: d.color })))
  const total = data.reduce((a, d) => a + d.value, 0)
  const shown = total > 0 ? data : [{ key: '__empty', label: '', value: 1 }]
  return (
    <div className={cn('relative z-10 mx-auto overflow-visible', className)} style={{ width: size, height: size }}>
      <ChartContainer
        config={cfg}
        className="aspect-square h-full w-full overflow-visible [&_.recharts-surface]:overflow-visible [&_.recharts-tooltip-wrapper]:!z-50 [&_.recharts-wrapper]:!overflow-visible"
      >
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          {total > 0 ? (
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="key" className="z-50 shadow-lg" />}
              wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
              offset={14}
              allowEscapeViewBox={{ x: true, y: true }}
            />
          ) : null}
          <Pie data={shown} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="92%" strokeWidth={2} paddingAngle={total > 0 ? 1 : 0}>
            {shown.map((d, i) => (
              <Cell key={d.key} fill={total > 0 ? (d as DonutDatum).color ?? CHART_COLORS[i % CHART_COLORS.length] : 'var(--muted)'} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      {centerValue ? (
        /* Hole-only overlay so hover tooltips on the ring paint above neighbouring legend text */
        <div className="pointer-events-none absolute inset-[22%] z-0 grid place-items-center text-center">
          <div>
            <div className="tabular text-2xl font-semibold leading-7">{centerValue}</div>
            {centerLabel ? <div className="text-xs text-muted-foreground">{centerLabel}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Tiny trend line for KPI cards. No axes, no tooltip. */
export function Sparkline({ values, color = 'var(--chart-2)', className }: { values: number[]; color?: string; className?: string }) {
  const data = values.map((v, i) => ({ i, v }))
  return (
    <div className={cn('h-full w-full', className)} aria-hidden>
      <ChartContainer config={{ v: { label: '', color } }} className="h-full w-full !aspect-auto">
        <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area dataKey="v" type="monotone" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.75} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

/** Legend row (dot + label + value) for donut/distribution cards. */
export function LegendList({ items }: { items: { key: string; label: string; value: string | number; color: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
            <span className="truncate">{it.label}</span>
          </span>
          <span className="tabular font-medium">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}
