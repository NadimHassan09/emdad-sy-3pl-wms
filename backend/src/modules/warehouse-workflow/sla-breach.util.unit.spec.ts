import { WarehouseTaskType } from '@prisma/client';

import {
  isTaskSlaBreached,
  slaBreachDeadlineMs,
  slaOverdueMinutes,
  slaTaskTypeLabel,
} from './sla-breach.util';

describe('sla-breach.util', () => {
  it('detects breached in-progress SLA', () => {
    const startedAt = new Date('2026-06-12T10:00:00Z');
    expect(isTaskSlaBreached({ startedAt, slaMinutes: 60 }, Date.parse('2026-06-12T11:01:00Z'))).toBe(
      true,
    );
    expect(isTaskSlaBreached({ startedAt, slaMinutes: 60 }, Date.parse('2026-06-12T10:30:00Z'))).toBe(
      false,
    );
  });

  it('returns false when SLA clock has not started', () => {
    expect(isTaskSlaBreached({ startedAt: null, slaMinutes: 60 })).toBe(false);
    expect(isTaskSlaBreached({ startedAt: new Date(), slaMinutes: null })).toBe(false);
  });

  it('computes breach deadline and overdue minutes', () => {
    const startedAt = new Date('2026-06-12T10:00:00Z');
    expect(slaBreachDeadlineMs(startedAt, 30)).toBe(Date.parse('2026-06-12T10:30:00Z'));
    expect(slaOverdueMinutes(startedAt, 30, Date.parse('2026-06-12T10:45:00Z'))).toBe(15);
  });

  it('labels task types for notifications', () => {
    expect(slaTaskTypeLabel(WarehouseTaskType.pick)).toBe('Pick');
    expect(slaTaskTypeLabel(WarehouseTaskType.receiving)).toBe('Receive');
  });
});
