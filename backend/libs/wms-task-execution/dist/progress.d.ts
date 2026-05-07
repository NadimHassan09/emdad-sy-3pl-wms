import { z } from 'zod';
/** PUT /tasks/:id/progress envelope (GAP1). Patch merges shallowly server-side today. */
export declare const taskProgressRequestSchema: z.ZodObject<{
    task_id: z.ZodOptional<z.ZodString>;
    schema_version: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    metadata: z.ZodOptional<z.ZodObject<{
        correlation_id: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        offline_batch_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    execution_state_patch: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strict>;
export type TaskProgressRequest = z.infer<typeof taskProgressRequestSchema>;
//# sourceMappingURL=progress.d.ts.map