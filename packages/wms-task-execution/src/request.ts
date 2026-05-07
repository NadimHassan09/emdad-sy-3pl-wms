import { z } from 'zod';

import { taskCompleteBodySchema, type TaskCompleteBody } from './complete';

/** Optional envelope header for complete/progress payloads (GAP1 Part III). */
export const taskExecutionMetadataSchema = z
  .object({
    correlation_id: z.string().optional(),
    device_id: z.string().optional(),
    offline_batch_id: z.string().optional(),
  })
  .strict()
  .optional();

/**
 * Full POST /tasks/:id/complete payload: optional `task_id` + `schema_version` + metadata
 * layered on discriminated completion body (`taskCompleteBodySchema`).
 * `task_id` must match `:id` when both are supplied.
 */
export const taskCompleteRequestSchema = z
  .object({
    task_id: z.string().uuid().optional(),
    /** Aligns conceptually with `warehouse_tasks.payload_schema_version` (GAP1). */
    schema_version: z.coerce.number().int().min(1).max(99).optional().default(1),
    metadata: taskExecutionMetadataSchema,
  })
  .and(taskCompleteBodySchema);

export type TaskCompleteRequest = z.infer<typeof taskCompleteRequestSchema>;

/** Strip envelope fields → shape expected by orchestration/handlers today. */
export function stripCompleteEnvelope(parsed: TaskCompleteRequest): TaskCompleteBody {
  const { task_id: _t, schema_version: _s, metadata: _m, ...rest } = parsed as TaskCompleteRequest & {
    task_id?: string;
    schema_version?: number;
    metadata?: unknown;
  };
  return rest as TaskCompleteBody;
}
