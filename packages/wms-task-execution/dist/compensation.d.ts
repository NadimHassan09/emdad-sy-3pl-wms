import { z } from 'zod';
/** MVP catalog — evolve with inventory helpers (plan GAP2). */
export declare const releaseReservationsOutboundActionSchema: z.ZodObject<{
    code: z.ZodLiteral<"RELEASE_RESERVATIONS_OUTBOUND">;
    task_id: z.ZodString;
}, z.core.$strip>;
export declare const markDamagedQtyActionSchema: z.ZodObject<{
    code: z.ZodLiteral<"MARK_DAMAGED_QTY">;
    task_id: z.ZodString;
    inbound_order_line_id: z.ZodString;
    qty: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const compensationActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    code: z.ZodLiteral<"RELEASE_RESERVATIONS_OUTBOUND">;
    task_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    code: z.ZodLiteral<"MARK_DAMAGED_QTY">;
    task_id: z.ZodString;
    inbound_order_line_id: z.ZodString;
    qty: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "code">;
export declare const workflowRecoverRequestSchema: z.ZodObject<{
    dry_run: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    actions: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        code: z.ZodLiteral<"RELEASE_RESERVATIONS_OUTBOUND">;
        task_id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        code: z.ZodLiteral<"MARK_DAMAGED_QTY">;
        task_id: z.ZodString;
        inbound_order_line_id: z.ZodString;
        qty: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "code">>;
}, z.core.$strip>;
export type WorkflowRecoverRequest = z.infer<typeof workflowRecoverRequestSchema>;
export type CompensationAction = z.infer<typeof compensationActionSchema>;
//# sourceMappingURL=compensation.d.ts.map