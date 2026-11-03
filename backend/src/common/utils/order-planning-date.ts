import { BadRequestException } from '@nestjs/common';

const YMD_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/**
 * Calendar YYYY-MM-DD prefix from an ISO date string (e.g. from class-validator `@IsDateString()`).
 * Uses the date digits as written — not shifted by timezone.
 */
export function extractCalendarYmd(value: string): string {
  const m = YMD_PREFIX.exec(value?.trim() ?? '');
  if (!m) {
    throw new BadRequestException('Date must include a YYYY-MM-DD calendar day.');
  }
  return m[1]!;
}

/** Server-local calendar today as YYYY-MM-DD (Node process timezone). */
export function calendarTodayYmdServerLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Rejects calendar dates strictly before the server's local "today". */
export function assertCalendarDateNotBeforeToday(value: string, fieldName: string): void {
  const ymd = extractCalendarYmd(value);
  const today = calendarTodayYmdServerLocal();
  if (ymd < today) {
    throw new BadRequestException(`${fieldName} cannot be before today.`);
  }
  // A plan date years away is a typo (for example 2999), not a real schedule.
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + MAX_PLANNING_DAYS_AHEAD);
  if (ymd > limit.toISOString().slice(0, 10)) {
    throw new BadRequestException(`${fieldName} cannot be more than 2 years from today.`);
  }
}

const MAX_PLANNING_DAYS_AHEAD = 730;
