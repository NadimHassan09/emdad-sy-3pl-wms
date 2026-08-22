import type { WorkflowTimelineTask } from '../api/workflows';
import type { WarehouseTaskListItem } from '../api/tasks';

/** Parse an ISO timestamp to ms, or null when missing/invalid. */
export function toTaskMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function taskStartedAtIso(
  task: Pick<WorkflowTimelineTask, 'startedAt' | 'assignments'>,
): string | null {
  return task.startedAt ?? task.assignments?.[0]?.assignedAt ?? null;
}

export function taskEndedAtIso(
  task: Pick<WorkflowTimelineTask, 'status' | 'completedAt'>,
): string | null {
  if (!task.completedAt) return null;
  if (isTaskTimingCompleteStatus(task.status)) return task.completedAt;
  return null;
}

export function isTaskTimingCompleteStatus(status: string): boolean {
  return ['completed', 'done', 'shipped', 'approved', 'closed', 'cancelled'].includes(status);
}

export function formatTaskDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export function taskDurationMs(
  task: Pick<WorkflowTimelineTask, 'startedAt' | 'completedAt' | 'status' | 'assignments'>,
  now = Date.now(),
): number | null {
  const start = toTaskMs(taskStartedAtIso(task));
  if (start == null) return null;
  const end = isTaskTimingCompleteStatus(task.status)
    ? toTaskMs(task.completedAt)
    : now;
  if (end == null) return null;
  const elapsed = end - start;
  return elapsed >= 0 ? elapsed : null;
}

export function taskListStartedAtIso(task: WarehouseTaskListItem): string | null {
  return task.startedAt ?? task.assignments?.[0]?.assignedAt ?? null;
}

export function taskListEndedAtIso(task: WarehouseTaskListItem): string | null {
  if (!task.completedAt) return null;
  if (isTaskTimingCompleteStatus(task.status)) return task.completedAt;
  return null;
}

export function taskListDurationMs(task: WarehouseTaskListItem, now = Date.now()): number | null {
  const start = toTaskMs(taskListStartedAtIso(task));
  if (start == null) return null;
  const end = isTaskTimingCompleteStatus(task.status)
    ? toTaskMs(taskListEndedAtIso(task))
    : now;
  if (end == null) return null;
  const elapsed = end - start;
  return elapsed >= 0 ? elapsed : null;
}
