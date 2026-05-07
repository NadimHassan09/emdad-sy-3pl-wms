"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskExecutionValidationError = void 0;
exports.safeParseTaskComplete = safeParseTaskComplete;
exports.parseTaskComplete = parseTaskComplete;
exports.validateCompleteVersion = validateCompleteVersion;
const request_1 = require("./request");
/** Safe parse with ZodIssue[] for Nest 400 payloads. */
function safeParseTaskComplete(raw) {
    const result = request_1.taskCompleteRequestSchema.safeParse(raw);
    if (!result.success) {
        return { success: false, issues: result.error.issues };
    }
    const request = result.data;
    const body = (0, request_1.stripCompleteEnvelope)(request);
    return { success: true, request, body };
}
function parseTaskComplete(raw, opts) {
    const parsed = request_1.taskCompleteRequestSchema.parse(raw);
    if (opts?.expectedTaskId && parsed.task_id && parsed.task_id !== opts.expectedTaskId) {
        throw new TaskExecutionValidationError([
            {
                code: 'custom',
                path: ['task_id'],
                message: 'task_id does not match URL parameter',
            },
        ]);
    }
    validateCompleteVersion(parsed.schema_version ?? 1);
    return (0, request_1.stripCompleteEnvelope)(parsed);
}
/** Thrown consumers map to BadRequestException. */
class TaskExecutionValidationError extends Error {
    issues;
    constructor(issues) {
        super('TASK_EXECUTION_VALIDATION_FAILED');
        this.issues = issues;
        this.name = 'TaskExecutionValidationError';
    }
}
exports.TaskExecutionValidationError = TaskExecutionValidationError;
const SUPPORTED_COMPLETE_VERSIONS = new Set([1]);
function validateCompleteVersion(version) {
    if (!SUPPORTED_COMPLETE_VERSIONS.has(version)) {
        throw new TaskExecutionValidationError([
            {
                code: 'custom',
                path: ['schema_version'],
                message: `Unsupported schema_version for complete: ${version}`,
            },
        ]);
    }
}
//# sourceMappingURL=registry.js.map