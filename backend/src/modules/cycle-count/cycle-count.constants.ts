import { LocationType } from '@prisma/client';

/** Allowed recurrence intervals (days) for warehouse cycle count schedules. */
export const CYCLE_COUNT_INTERVAL_DAYS = [7, 30, 90] as const;

export type CycleCountIntervalDays = (typeof CYCLE_COUNT_INTERVAL_DAYS)[number];

export const CYCLE_COUNT_ACTIVE_STATUSES = [
  'scheduled',
  'in_progress',
  'pending_review',
] as const;

/** Location types that hold countable stock (aligned with adjustments). */
export const CYCLE_COUNT_LOCATION_TYPES: LocationType[] = [
  'internal',
  'fridge',
  'quarantine',
  'scrap',
];

export function isValidCycleCountInterval(days: number): days is CycleCountIntervalDays {
  return (CYCLE_COUNT_INTERVAL_DAYS as readonly number[]).includes(days);
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
