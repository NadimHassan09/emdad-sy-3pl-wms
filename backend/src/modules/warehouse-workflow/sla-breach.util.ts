import { WarehouseTaskType } from '@prisma/client';

export const SLA_ESCALATION_COOLDOWN_MS = 60 * 60 * 1000;

const TASK_TYPE_LABELS: Partial<Record<WarehouseTaskType, string>> = {
  [WarehouseTaskType.receiving]: 'Receive',
  [WarehouseTaskType.qc]: 'QC',
  [WarehouseTaskType.putaway]: 'Putaway',
  [WarehouseTaskType.putaway_quarantine]: 'Putaway (quarantine)',
  [WarehouseTaskType.pick]: 'Pick',
  [WarehouseTaskType.pack]: 'Pack',
  [WarehouseTaskType.dispatch]: 'Dispatch',
};

export function slaTaskTypeLabel(taskType: WarehouseTaskType): string {
  return TASK_TYPE_LABELS[taskType] ?? taskType;
}

export function slaBreachDeadlineMs(startedAt: Date, slaMinutes: number): number {
  return startedAt.getTime() + slaMinutes * 60_000;
}

export function isTaskSlaBreached(
  task: { startedAt: Date | null; slaMinutes: number | null },
  nowMs = Date.now(),
): boolean {
  if (task.startedAt == null || task.slaMinutes == null) return false;
  return nowMs > slaBreachDeadlineMs(task.startedAt, task.slaMinutes);
}

export function slaOverdueMinutes(
  startedAt: Date,
  slaMinutes: number,
  nowMs = Date.now(),
): number {
  const deadline = slaBreachDeadlineMs(startedAt, slaMinutes);
  return Math.max(0, Math.floor((nowMs - deadline) / 60_000));
}
