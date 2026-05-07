import { z } from 'zod';
/** Receiving completion (staging / operational receive). */
export declare const completeReceivingSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const completeQcSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"qc">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        passed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        failed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const completePutawaySchema: z.ZodObject<{
    task_type: z.ZodLiteral<"putaway">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        putaway_quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        destination_location_id: z.ZodString;
        lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const completePutawayQuarantineSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"putaway_quarantine">;
    lines: z.ZodArray<z.ZodObject<{
        inbound_order_line_id: z.ZodString;
        putaway_quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        destination_location_id: z.ZodString;
        lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const completePickSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"pick">;
    picks: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        lines: z.ZodArray<z.ZodObject<{
            location_id: z.ZodString;
            lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            quantity: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const completePackSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"pack">;
    lines: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        packed_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
        package_label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const completeDispatchSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"dispatch">;
    lines: z.ZodArray<z.ZodObject<{
        outbound_order_line_id: z.ZodString;
        ship_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
    }, z.core.$strip>>;
    carrier: z.ZodOptional<z.ZodString>;
    tracking: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const completeRoutingSchema: z.ZodObject<{
    task_type: z.ZodLiteral<"routing">;
    destination_location_id: z.ZodString;
    transferred_qty: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<string, string | number>>;
    lot_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    inbound_order_line_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Discriminator-only body — no envelope header fields. */
export declare const taskCompleteBodySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strip>], "task_type">;
export type TaskCompleteBody = z.infer<typeof taskCompleteBodySchema>;
export type TaskExecutionTaskType = TaskCompleteBody['task_type'];
//# sourceMappingURL=complete.d.ts.map