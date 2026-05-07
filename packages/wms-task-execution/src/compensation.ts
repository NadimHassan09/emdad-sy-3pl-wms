import { z } from 'zod';

/** MVP catalog — evolve with inventory helpers (plan GAP2). */

export const releaseReservationsOutboundActionSchema = z.object({
  code: z.literal('RELEASE_RESERVATIONS_OUTBOUND'),
  task_id: z.string().uuid(),
});

export const markDamagedQtyActionSchema = z.object({
  code: z.literal('MARK_DAMAGED_QTY'),
  task_id: z.string().uuid(),
  inbound_order_line_id: z.string().uuid(),
  qty: z.string(),
  notes: z.string().optional(),
});

export const compensationActionSchema = z.discriminatedUnion('code', [
  releaseReservationsOutboundActionSchema,
  markDamagedQtyActionSchema,
]);

export const workflowRecoverRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  actions: z.array(compensationActionSchema).min(1).max(20),
});

export type WorkflowRecoverRequest = z.infer<typeof workflowRecoverRequestSchema>;
export type CompensationAction = z.infer<typeof compensationActionSchema>;
