import { z } from 'zod';
import { type TaskCompleteBody } from './complete';
/** Optional envelope header for complete/progress payloads (GAP1 Part III). */
export declare const taskExecutionMetadataSchema: z.ZodOptional<z.ZodObject<{
    correlation_id: z.ZodOptional<z.ZodString>;
    device_id: z.ZodOptional<z.ZodString>;
    offline_batch_id: z.ZodOptional<z.ZodString>;
}, z.core.$strict>>;
/**
 * Full POST /tasks/:id/complete payload: optional `task_id` + `schema_version` + metadata
 * layered on discriminated completion body (`taskCompleteBodySchema`).
 * `task_id` must match `:id` when both are supplied.
 */
export declare const taskCompleteRequestSchema: z.ZodIntersection<z.ZodObject<{
    task_id: z.ZodOptional<z.ZodString>;
    schema_version: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    metadata: z.ZodOptional<z.ZodObject<{
        correlation_id: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        offline_batch_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strip>, z.ZodDiscriminatedUnion<[z.ZodObject<{
    task_type: z.ZodLiteral<"receiving">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        received_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        capture_lot_number: z.ZodOptional<z.ZodString>;
        discrepancy_notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    allow_short_close: z.ZodOptional<z.ZodBoolean>;
    short_close_reason_code: z.ZodOptional<z.ZodEnum<{
        damage: "damage";
        not_found: "not_found";
        other: "other";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"qc">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        passed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        failed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"putaway">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        putaway_quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        destination_location_id: z.ZodString;
        lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"putaway_quarantine">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        putaway_quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        destination_location_id: z.ZodString;
        lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"pick">;
    picks: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        lines: z.ZodArray<z.ZodObject<{
            location_id: z.ZodString;
            lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"pack">;
    lines: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        packed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        package_label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"dispatch">;
    lines: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        ship_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>;
    carrier: z.ZodOptional<z.ZodString>;
    tracking: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    task_type: z.ZodLiteral<"routing">;
    destination_location_id: z.ZodString;
    transferred_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
    lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    inbound_order_line_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "task_type">>;
export type TaskCompleteRequest = z.infer<typeof taskCompleteRequestSchema>;
/** Strip envelope fields → shape expected by orchestration/handlers today. */
export declare function stripCompleteEnvelope(parsed: TaskCompleteRequest): TaskCompleteBody;
//# sourceMappingURL=request.d.ts.map