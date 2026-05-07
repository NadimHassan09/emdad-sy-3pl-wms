export type PieSlice = { label: string; count: number; color: string };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

type PieChartProps = {
  title: string;
  slices: PieSlice[];
  size?: number;
};

export function PieChart({ title, slices, size = 200 }: PieChartProps) {
  const normalized = slices.map((s) => ({ ...s, count: num(s.count) }));
  const total = normalized.reduce((s, x) => s + x.count, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  const positive = normalized.filter((sl) => sl.count > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={title}>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
          ) : positive.length === 1 ? (
            <circle cx={cx} cy={cy} r={r} fill={positive[0]!.color}>
              <title>{`${positive[0]!.label}: ${positive[0]!.count}`}</title>
            </circle>
          ) : (
            (() => {
              let angle = -Math.PI / 2;
              return positive.map((sl) => {
                const frac = sl.count / total;
                const start = angle;
                const end = angle + frac * 2 * Math.PI;
                angle = end;
                const d = describeSlice(cx, cy, r, start, end);
                return (
                  <path key={sl.label} d={d} fill={sl.color} stroke="white" strokeWidth="1">
                    <title>{`${sl.label}: ${sl.count}`}</title>
                  </path>
                );
              });
            })()
          )}
        </svg>
        <ul className="min-w-[10rem] space-y-1.5 text-sm">
          {normalized.map((sl) => {
            const pct = total > 0 ? Math.round((sl.count / total) * 100) : 0;
            return (
              <li key={sl.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: sl.color }} />
                <span className="text-slate-700">
                  {sl.label}
                  <span className="text-slate-500">
                    {' '}
                    ({sl.count}
                    {total > 0 ? ` · ${pct}%` : ''})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-center text-xs text-slate-500">No open orders in this view.</p>
      ) : null}
    </div>
  );
}
