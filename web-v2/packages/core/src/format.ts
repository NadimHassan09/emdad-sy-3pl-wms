/** Locale-aware formatting helpers (Latin digits in Arabic UI for scan-friendly numbers). */
export function formatNumber(value: number | null | undefined, locale: string, opts?: Intl.NumberFormatOptions): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatCurrency(value: number | null | undefined, locale: string, currency = 'USD'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string | number | Date | null | undefined, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, opts ?? { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}

export function formatDateTime(value: string | number | Date | null | undefined, locale: string): string {
  return formatDate(value, locale, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(iso: string, locale: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return formatDate(iso, locale);
}
