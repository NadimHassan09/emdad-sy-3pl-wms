"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskProgressRequestSchema = void 0;
const zod_1 = require("zod");
const request_1 = require("./request");
exports.taskProgressRequestSchema = zod_1.z
    .object({
    task_id: zod_1.z.string().uuid().optional(),
    schema_version: zod_1.z.coerce.number().int().min(1).max(99).optional().default(1),
    metadata: request_1.taskExecutionMetadataSchema,
    execution_state_patch: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
})
    .strict();
//# sourceMappingURL=progress.js.map