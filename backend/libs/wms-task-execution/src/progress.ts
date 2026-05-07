import { z } from 'zod';

import { taskExecutionMetadataSchema } from './request';

/** PUT /tasks/:id/progress envelope (GAP1). Patch merges shallowly server-side today. */
export const taskProgressRequestSchema = z
  .object({
    task_id: z.string().uuid().optional(),
    schema_version: z.coerce.number().int().min(1).max(99).optional().default(1),
    metadata: taskExecutionMetadataSchema,
    execution_state_patch: z.record(z.string(), z.unknown()),
  })
  .strict();

export type TaskProgressRequest = z.infer<typeof taskProgressRequestSchema>;
