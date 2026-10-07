export function localCalendarDateYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extractCalendarYmd(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1]! : null;
}

export function isYmdOnOrAfterLocalToday(ymd: string): boolean {
  const t = extractCalendarYmd(ymd);
  if (!t) return false;
  return t >= localCalendarDateYmd();
}
