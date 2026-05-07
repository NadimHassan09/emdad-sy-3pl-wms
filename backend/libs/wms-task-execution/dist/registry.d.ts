import type { ZodIssue } from 'zod';
import type { TaskCompleteBody } from './complete';
import { type TaskCompleteRequest } from './request';
/** Parsed complete result with body ready for handlers. */
export interface ParseCompleteSuccess {
    success: true;
    request: TaskCompleteRequest;
    body: TaskCompleteBody;
}
export interface ParseCompleteFailure {
    success: false;
    issues: ZodIssue[];
}
/** Safe parse with ZodIssue[] for Nest 400 payloads. */
export declare function safeParseTaskComplete(raw: unknown): ParseCompleteSuccess | ParseCompleteFailure;
export declare function parseTaskComplete(raw: unknown, opts?: {
    expectedTaskId?: string;
}): TaskCompleteBody;
/** Thrown consumers map to BadRequestException. */
export declare class TaskExecutionValidationError extends Error {
    readonly issues: ZodIssue[];
    constructor(issues: ZodIssue[]);
}
export declare function validateCompleteVersion(version: number): void;
//# sourceMappingURL=registry.d.ts.map