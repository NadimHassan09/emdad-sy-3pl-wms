export type BackupScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export type BackupScheduleLike = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  hour: number;
  minute: number;
  lastRunAt: string | null;
  createdAt: string;
};

function atScheduleTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Next run time for an enabled schedule after `now` (browser local time). */
export function getNextBackupScheduleRun(schedule: BackupScheduleLike, now: Date): Date | null {
  if (!schedule.enabled) return null;

  const anchor = new Date(schedule.createdAt);
  if (Number.isNaN(anchor.getTime())) return null;

  switch (schedule.frequency) {
    case 'daily': {
      let next = atScheduleTime(now, schedule.hour, schedule.minute);
      if (next <= now) {
        next = atScheduleTime(new Date(now.getTime() + 86_400_000), schedule.hour, schedule.minute);
      }
      return next;
    }
    case 'weekly': {
      const targetDay = anchor.getDay();
      for (let offset = 0; offset < 8; offset += 1) {
        const day = new Date(now.getTime() + offset * 86_400_000);
        if (day.getDay() !== targetDay) continue;
        const next = atScheduleTime(day, schedule.hour, schedule.minute);
        if (next > now) return next;
      }
      return atScheduleTime(
        new Date(now.getTime() + 7 * 86_400_000),
        schedule.hour,
        schedule.minute,
      );
    }
    case 'monthly': {
      const targetDate = anchor.getDate();
      for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
        const probe = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const lastDay = new Date(probe.getFullYear(), probe.getMonth() + 1, 0).getDate();
        const day = Math.min(targetDate, lastDay);
        const next = atScheduleTime(
          new Date(probe.getFullYear(), probe.getMonth(), day),
          schedule.hour,
          schedule.minute,
        );
        if (next > now) return next;
      }
      return null;
    }
    default:
      return null;
  }
}

export function formatScheduleFrequency(frequency: BackupScheduleFrequency): string {
  const labels: Record<BackupScheduleFrequency, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  return labels[frequency] ?? frequency;
}

export function formatScheduleTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
