import { InboundApi } from '../api/inbound';
import { OutboundApi } from '../api/outbound';
import { TasksApi, type WarehouseTaskListItem } from '../api/tasks';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export type TaskSearchResolve =
  | { kind: 'none' }
  | { kind: 'referenceId'; referenceId: string }
  | { kind: 'singleTask'; task: WarehouseTaskListItem }
  | { kind: 'noMatch' };

/** Resolve Tasks list search without new API params (order # / task id / reference UUID). */
export async function resolveTaskListSearch(raw: string): Promise<TaskSearchResolve> {
  const q = raw.trim();
  if (!q) return { kind: 'none' };

  if (isUuidLike(q)) {
    try {
      const task = await TasksApi.get(q);
      return { kind: 'singleTask', task: task as WarehouseTaskListItem };
    } catch {
      return { kind: 'referenceId', referenceId: q };
    }
  }

  const [inbound, outbound] = await Promise.all([
    InboundApi.list({ orderSearch: q, limit: 10 }),
    OutboundApi.list({ orderSearch: q, limit: 10 }),
  ]);
  const match = inbound.items[0] ?? outbound.items[0];
  if (match?.id) return { kind: 'referenceId', referenceId: match.id };
  return { kind: 'noMatch' };
}

export async function resolveOrderNumberLabel(
  referenceType: string | undefined,
  referenceId: string | undefined,
): Promise<string | null> {
  if (!referenceId) return null;
  try {
    if (referenceType === 'inbound_order') {
      const o = await InboundApi.get(referenceId);
      return o.orderNumber || null;
    }
    if (referenceType === 'outbound_order') {
      const o = await OutboundApi.get(referenceId);
      return o.orderNumber || null;
    }
    // Unknown type: try inbound then outbound
    try {
      const o = await InboundApi.get(referenceId);
      return o.orderNumber || null;
    } catch {
      const o = await OutboundApi.get(referenceId);
      return o.orderNumber || null;
    }
  } catch {
    return null;
  }
}
