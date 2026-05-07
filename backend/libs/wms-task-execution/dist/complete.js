"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCompleteBodySchema = exports.completeRoutingSchema = exports.completeDispatchSchema = exports.completePackSchema = exports.completePickSchema = exports.completePutawayQuarantineSchema = exports.completePutawaySchema = exports.completeQcSchema = exports.completeReceivingSchema = void 0;
const zod_1 = require("zod");
const decimalish = zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((v) => String(v));
/** Receiving completion (staging / operational receive). */
exports.completeReceivingSchema = zod_1.z.object({
    task_type: zod_1.z.literal('receiving'),
    lines: zod_1.z.array(zod_1.z.object({
        inbound_order_line_id: zod_1.z.string().uuid(),
        received_qty: decimalish,
        lot_id: zod_1.z.string().uuid().optional().nullable(),
        capture_lot_number: zod_1.z.string().optional(),
        discrepancy_notes: zod_1.z.string().optional(),
    })),
    allow_short_close: zod_1.z.boolean().optional(),
    short_close_reason_code: zod_1.z.enum(['damage', 'not_found', 'other']).optional(),
});
exports.completeQcSchema = zod_1.z.object({
    task_type: zod_1.z.literal('qc'),
    lines: zod_1.z.array(zod_1.z.object({
        inbound_order_line_id: zod_1.z.string().uuid(),
        passed_qty: decimalish,
        failed_qty: decimalish,
        notes: zod_1.z.string().optional(),
    })),
});
const putawayLineSchema = zod_1.z.object({
    inbound_order_line_id: zod_1.z.string().uuid(),
    putaway_quantity: decimalish,
    destination_location_id: zod_1.z.string().uuid(),
    lot_id: zod_1.z.string().uuid().optional().nullable(),
});
exports.completePutawaySchema = zod_1.z.object({
    task_type: zod_1.z.literal('putaway'),
    lines: zod_1.z.array(putawayLineSchema),
});
exports.completePutawayQuarantineSchema = zod_1.z.object({
    task_type: zod_1.z.literal('putaway_quarantine'),
    lines: zod_1.z.array(putawayLineSchema),
});
const pickLineSchema = zod_1.z.object({
    location_id: zod_1.z.string().uuid(),
    lot_id: zod_1.z.string().uuid().optional().nullable(),
    quantity: decimalish,
});
exports.completePickSchema = zod_1.z.object({
    task_type: zod_1.z.literal('pick'),
    picks: zod_1.z.array(zod_1.z.object({
        outbound_order_line_id: zod_1.z.string().uuid(),
        lines: zod_1.z.array(pickLineSchema),
    })),
});
exports.completePackSchema = zod_1.z.object({
    task_type: zod_1.z.literal('pack'),
    lines: zod_1.z.array(zod_1.z.object({
        outbound_order_line_id: zod_1.z.string().uuid(),
        packed_qty: decimalish,
        package_label: zod_1.z.string().optional(),
    })),
});
exports.completeDispatchSchema = zod_1.z.object({
    task_type: zod_1.z.literal('dispatch'),
    lines: zod_1.z.array(zod_1.z.object({
        outbound_order_line_id: zod_1.z.string().uuid(),
        ship_qty: decimalish,
    })),
    carrier: zod_1.z.string().optional(),
    tracking: zod_1.z.string().optional(),
});
exports.completeRoutingSchema = zod_1.z.object({
    task_type: zod_1.z.literal('routing'),
    destination_location_id: zod_1.z.string().uuid(),
    transferred_qty: decimalish,
    lot_id: zod_1.z.string().uuid().optional().nullable(),
    inbound_order_line_id: zod_1.z.string().uuid().optional(),
});
/** Discriminator-only body — no envelope header fields. */
exports.taskCompleteBodySchema = zod_1.z.discriminatedUnion('task_type', [
    exports.completeReceivingSchema,
    exports.completeQcSchema,
    exports.completePutawaySchema,
    exports.completePutawayQuarantineSchema,
    exports.completePickSchema,
    exports.completePackSchema,
    exports.completeDispatchSchema,
    exports.completeRoutingSchema,
]);
//# sourceMappingURL=complete.js.map