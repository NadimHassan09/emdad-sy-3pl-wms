import {
  eachDayOfInterval,
  format,
  formatDistanceToNow,
  startOfDay,
  subDays,
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export type PeriodKey = '7' | '30' | '90';

export function greetingForHour(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string | undefined | null, fallback = 'Admin'): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0] ?? fallback;
}

export function numberFmt(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function percentFmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(digits)}%`;
}

export function periodStart(period: PeriodKey, now = new Date()): Date {
  return startOfDay(subDays(now, Number(period) - 1));
}

export function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function relativeTime(iso: string, isArabic: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: isArabic ? ar : enUS,
  });
}

export function lastUpdatedLabel(updatedAt: Date, isArabic: boolean): string {
  return formatDistanceToNow(updatedAt, {
    addSuffix: true,
    locale: isArabic ? ar : enUS,
  });
}

export type DayBin = { date: string; label: string; count: number };

export function emptyDayBins(from: Date, to: Date): DayBin[] {
  return eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) }).map((d) => ({
    date: toYmd(d),
    label: format(d, 'MMM d'),
    count: 0,
  }));
}

export function binByDay(
  items: Array<{ createdAt: string }>,
  from: Date,
  to: Date,
): DayBin[] {
  const bins = emptyDayBins(from, to);
  const index = new Map(bins.map((b, i) => [b.date, i]));
  for (const item of items) {
    const key = toYmd(new Date(item.createdAt));
    const i = index.get(key);
    if (i == null) continue;
    bins[i]!.count += 1;
  }
  return bins;
}

export function periodDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function sumRange(bins: DayBin[], start: number, end: number): number {
  return bins.slice(start, end).reduce((s, b) => s + b.count, 0);
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(','))].join(
    '\n',
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function cbmNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
