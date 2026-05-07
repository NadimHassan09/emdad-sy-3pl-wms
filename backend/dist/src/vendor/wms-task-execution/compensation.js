"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowRecoverRequestSchema = exports.compensationActionSchema = exports.markDamagedQtyActionSchema = exports.releaseReservationsOutboundActionSchema = void 0;
const zod_1 = require("zod");
exports.releaseReservationsOutboundActionSchema = zod_1.z.object({
    code: zod_1.z.literal('RELEASE_RESERVATIONS_OUTBOUND'),
    task_id: zod_1.z.string().uuid(),
});
exports.markDamagedQtyActionSchema = zod_1.z.object({
    code: zod_1.z.literal('MARK_DAMAGED_QTY'),
    task_id: zod_1.z.string().uuid(),
    inbound_order_line_id: zod_1.z.string().uuid(),
    qty: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
exports.compensationActionSchema = zod_1.z.discriminatedUnion('code', [
    exports.releaseReservationsOutboundActionSchema,
    exports.markDamagedQtyActionSchema,
]);
exports.workflowRecoverRequestSchema = zod_1.z.object({
    dry_run: zod_1.z.boolean().optional().default(false),
    actions: zod_1.z.array(exports.compensationActionSchema).min(1).max(20),
});
//# sourceMappingURL=compensation.js.map