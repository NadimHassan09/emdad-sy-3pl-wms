import { z } from 'zod';

const decimalish = z.union([z.number(), z.string()]).transform((v) => String(v));

/** Receiving completion (staging / operational receive). */
export const completeReceivingSchema = z.object({
  task_type: z.literal('receiving'),
  lines: z.array(
    z.object({
      inbound_order_line_id: z.string().uuid(),
      received_qty: decimalish,
      lot_id: z.string().uuid().optional().nullable(),
      capture_lot_number: z.string().optional(),
      discrepancy_notes: z.string().optional(),
    }),
  ),
  allow_short_close: z.boolean().optional(),
  short_close_reason_code: z.enum(['damage', 'not_found', 'other']).optional(),
});

export const completeQcSchema = z.object({
  task_type: z.literal('qc'),
  lines: z.array(
    z.object({
      inbound_order_line_id: z.string().uuid(),
      passed_qty: decimalish,
      failed_qty: decimalish,
      notes: z.string().optional(),
    }),
  ),
});

const putawayLineSchema = z.object({
  inbound_order_line_id: z.string().uuid(),
  putaway_quantity: decimalish,
  destination_location_id: z.string().uuid(),
  lot_id: z.string().uuid().optional().nullable(),
});

export const completePutawaySchema = z.object({
  task_type: z.literal('putaway'),
  lines: z.array(putawayLineSchema),
});

export const completePutawayQuarantineSchema = z.object({
  task_type: z.literal('putaway_quarantine'),
  lines: z.array(putawayLineSchema),
});

const pickLineSchema = z.object({
  location_id: z.string().uuid(),
  lot_id: z.string().uuid().optional().nullable(),
  quantity: decimalish,
});

export const completePickSchema = z.object({
  task_type: z.literal('pick'),
  picks: z.array(
    z.object({
      outbound_order_line_id: z.string().uuid(),
      lines: z.array(pickLineSchema),
    }),
  ),
});

export const completePackSchema = z.object({
  task_type: z.literal('pack'),
  lines: z.array(
    z.object({
      outbound_order_line_id: z.string().uuid(),
      packed_qty: decimalish,
      package_label: z.string().optional(),
    }),
  ),
});

export const completeDispatchSchema = z.object({
  task_type: z.literal('dispatch'),
  lines: z.array(
    z.object({
      outbound_order_line_id: z.string().uuid(),
      ship_qty: decimalish,
    }),
  ),
  carrier: z.string().optional(),
  tracking: z.string().optional(),
});

export const completeRoutingSchema = z.object({
  task_type: z.literal('routing'),
  destination_location_id: z.string().uuid(),
  transferred_qty: decimalish,
  lot_id: z.string().uuid().optional().nullable(),
  inbound_order_line_id: z.string().uuid().optional(),
});

/** Discriminator-only body — no envelope header fields. */
export const taskCompleteBodySchema = z.discriminatedUnion('task_type', [
  completeReceivingSchema,
  completeQcSchema,
  completePutawaySchema,
  completePutawayQuarantineSchema,
  completePickSchema,
  completePackSchema,
  completeDispatchSchema,
  completeRoutingSchema,
]);

export type TaskCompleteBody = z.infer<typeof taskCompleteBodySchema>;

export type TaskExecutionTaskType = TaskCompleteBody['task_type'];
