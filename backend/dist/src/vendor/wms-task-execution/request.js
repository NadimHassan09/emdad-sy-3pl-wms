"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCompleteRequestSchema = exports.taskExecutionMetadataSchema = void 0;
exports.stripCompleteEnvelope = stripCompleteEnvelope;
const zod_1 = require("zod");
const complete_1 = require("./complete");
exports.taskExecutionMetadataSchema = zod_1.z
    .object({
    correlation_id: zod_1.z.string().optional(),
    device_id: zod_1.z.string().optional(),
    offline_batch_id: zod_1.z.string().optional(),
})
    .strict()
    .optional();
exports.taskCompleteRequestSchema = zod_1.z
    .object({
    task_id: zod_1.z.string().uuid().optional(),
    schema_version: zod_1.z.coerce.number().int().min(1).max(99).optional().default(1),
    metadata: exports.taskExecutionMetadataSchema,
})
    .and(complete_1.taskCompleteBodySchema);
function stripCompleteEnvelope(parsed) {
    const { task_id: _t, schema_version: _s, metadata: _m, ...rest } = parsed;
    return rest;
}
//# sourceMappingURL=request.js.map