"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCompleteRequestSchema = exports.taskExecutionMetadataSchema = void 0;
exports.stripCompleteEnvelope = stripCompleteEnvelope;
const zod_1 = require("zod");
const complete_1 = require("./complete");
/** Optional envelope header for complete/progress payloads (GAP1 Part III). */
exports.taskExecutionMetadataSchema = zod_1.z
    .object({
    correlation_id: zod_1.z.string().optional(),
    device_id: zod_1.z.string().optional(),
    offline_batch_id: zod_1.z.string().optional(),
})
    .strict()
    .optional();
/**
 * Full POST /tasks/:id/complete payload: optional `task_id` + `schema_version` + metadata
 * layered on discriminated completion body (`taskCompleteBodySchema`).
 * `task_id` must match `:id` when both are supplied.
 */
exports.taskCompleteRequestSchema = zod_1.z
    .object({
    task_id: zod_1.z.string().uuid().optional(),
    /** Aligns conceptually with `warehouse_tasks.payload_schema_version` (GAP1). */
    schema_version: zod_1.z.coerce.number().int().min(1).max(99).optional().default(1),
    metadata: exports.taskExecutionMetadataSchema,
})
    .and(complete_1.taskCompleteBodySchema);
/** Strip envelope fields → shape expected by orchestration/handlers today. */
function stripCompleteEnvelope(parsed) {
    const { task_id: _t, schema_version: _s, metadata: _m, ...rest } = parsed;
    return rest;
}
//# sourceMappingURL=request.js.map