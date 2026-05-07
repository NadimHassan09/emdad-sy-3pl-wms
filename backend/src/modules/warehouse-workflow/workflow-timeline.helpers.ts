import { WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

import { getFrontierBlockedReason } from './task-runnable.util';

export type TimelineStepUiStatus = 'pending' | 'locked' | 'done';

/** Ordered timeline lane for inbound/outbound detail (TASK_ONLY_FLOWS). */
export interface WorkflowTimelineStepDto {
  key: string;
  label: string;
  status: TimelineStepUiStatus;
  taskId: string | null;
}

type TaskLight = {
  id: string;
  workflowInstanceId: string;
  taskType: WarehouseTaskType;
  status: WarehouseTaskStatus;
};

type FullTaskRow = TaskLight & { createdAt: Date };

const TERMINAL: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.completed,
  WarehouseTaskStatus.cancelled,
];

function matchesTypes(t: WarehouseTaskType, allowed: WarehouseTaskType[]): boolean {
  return allowed.includes(t);
}

function matchesForStep(
  tasks: FullTaskRow[],
  types: WarehouseTaskType[],
): FullTaskRow[] {
  return tasks.filter((t) => matchesTypes(t.taskType, types)).sort((a, b) => +a.createdAt - +b.createdAt);
}

function deriveStepStatus(
  matches: FullTaskRow[],
  light: TaskLight[],
  referenceTag: 'inbound_order' | 'outbound_order',
): TimelineStepUiStatus {
  if (matches.length === 0) return 'locked';
  const allDone =
    matches.length > 0 &&
    matches.every((t) => t.status === WarehouseTaskStatus.completed);
  if (allDone) return 'done';

  const open = matches.filter((t) => !TERMINAL.includes(t.status));
  if (open.length === 0) return 'done';

  const runnable = open.some((t) => getFrontierBlockedReason(t.id, light, referenceTag) === null);
  return runnable ? 'pending' : 'locked';
}

const INBOUND_TEMPLATE: Array<{ key: string; label: string; taskTypes: WarehouseTaskType[] }> = [
  { key: 'receive', label: 'Receive', taskTypes: [WarehouseTaskType.receiving] },
  {
    key: 'putaway',
    label: 'Putaway',
    taskTypes: [WarehouseTaskType.putaway, WarehouseTaskType.putaway_quarantine],
  },
];

const OUTBOUND_TEMPLATE: Array<{ key: string; label: string; taskTypes: WarehouseTaskType[] }> = [
  { key: 'pick', label: 'Pick', taskTypes: [WarehouseTaskType.pick] },
  { key: 'pack', label: 'Pack', taskTypes: [WarehouseTaskType.pack] },
  { key: 'dispatch', label: 'Dispatch', taskTypes: [WarehouseTaskType.dispatch] },
];

export function buildWorkflowTimelineSteps(
  referenceType: 'inbound_order' | 'outbound_order',
  tasks: FullTaskRow[],
): WorkflowTimelineStepDto[] {
  const light: TaskLight[] = tasks.map((t) => ({
    id: t.id,
    workflowInstanceId: t.workflowInstanceId,
    taskType: t.taskType,
    status: t.status,
  }));

  const tmpl = referenceType === 'inbound_order' ? INBOUND_TEMPLATE : OUTBOUND_TEMPLATE;

  return tmpl.map((def) => {
    const matches = matchesForStep(tasks, def.taskTypes);
    return {
      key: def.key,
      label: def.label,
      status: deriveStepStatus(matches, light, referenceType),
      taskId: matches[0]?.id ?? null,
    };
  });
}
