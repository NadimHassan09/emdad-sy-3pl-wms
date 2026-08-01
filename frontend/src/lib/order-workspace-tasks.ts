import type { WorkflowTimelineTask } from '../api/workflows';

export function isOpenTaskStatus(status: string): boolean {
  return status === 'pending' || status === 'assigned' || status === 'in_progress';
}

export function isCompletedTaskStatus(status: string): boolean {
  return status === 'completed' || status === 'done' || status === 'shipped';
}

export function findTimelineTask(
  tasks: WorkflowTimelineTask[],
  taskType: string,
  opts?: { openOnly?: boolean; preferCompleted?: boolean },
): WorkflowTimelineTask | undefined {
  const matches = tasks.filter((t) => t.taskType === taskType);
  if (matches.length === 0) return undefined;

  if (opts?.openOnly) {
    return matches.find((t) => isOpenTaskStatus(t.status));
  }

  if (opts?.preferCompleted) {
    const completed = matches.filter((t) => isCompletedTaskStatus(t.status));
    if (completed.length > 0) {
      return completed.sort((a, b) => {
        const aMs = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bMs = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bMs - aMs;
      })[0];
    }
  }

  return matches[0];
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function readWorkspacePlanLines(payload: unknown): Record<string, Record<string, string>> {
  if (!isRecord(payload)) return {};
  const wp = payload.workspace_plan ?? payload.workspacePlan;
  if (!isRecord(wp)) return {};
  const lines = wp.lines;
  if (!Array.isArray(lines)) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const row of lines) {
    if (!isRecord(row)) continue;
    const lineId =
      typeof row.inbound_order_line_id === 'string'
        ? row.inbound_order_line_id
        : typeof row.outbound_order_line_id === 'string'
          ? row.outbound_order_line_id
          : null;
    if (!lineId) continue;
    const draft: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' || typeof v === 'number') draft[k] = String(v);
    }
    out[lineId] = draft;
  }
  return out;
}
