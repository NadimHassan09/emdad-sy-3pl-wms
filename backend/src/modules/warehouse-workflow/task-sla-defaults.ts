import { WarehouseTaskType } from '@prisma/client';

/** Default SLA minutes when creating tasks (Part III GAP4). */
export const DEFAULT_SLA_MINUTES_BY_TASK_TYPE: Partial<Record<WarehouseTaskType, number>> = {
  [WarehouseTaskType.receiving]: 1440,
  [WarehouseTaskType.qc]: 720,
  [WarehouseTaskType.putaway]: 2880,
  [WarehouseTaskType.putaway_quarantine]: 2880,
  [WarehouseTaskType.pick]: 480,
  [WarehouseTaskType.pack]: 240,
  [WarehouseTaskType.dispatch]: 360,
};

export function defaultSlaMinutesForTaskType(taskType: WarehouseTaskType): number | undefined {
  return DEFAULT_SLA_MINUTES_BY_TASK_TYPE[taskType];
}
