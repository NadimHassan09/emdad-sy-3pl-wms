import type { ZodIssue } from 'zod';

import type { TaskCompleteBody } from './complete';
import { taskCompleteRequestSchema, stripCompleteEnvelope, type TaskCompleteRequest } from './request';

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
export function safeParseTaskComplete(raw: unknown): ParseCompleteSuccess | ParseCompleteFailure {
  const result = taskCompleteRequestSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, issues: result.error.issues };
  }
  const request = result.data;
  const body = stripCompleteEnvelope(request);
  return { success: true, request, body };
}

export function parseTaskComplete(
  raw: unknown,
  opts?: { expectedTaskId?: string },
): TaskCompleteBody {
  const parsed = taskCompleteRequestSchema.parse(raw);
  if (opts?.expectedTaskId && parsed.task_id && parsed.task_id !== opts.expectedTaskId) {
    throw new TaskExecutionValidationError([
      {
        code: 'custom',
        path: ['task_id'],
        message: 'task_id does not match URL parameter',
      },
    ] as ZodIssue[]);
  }

  validateCompleteVersion(parsed.schema_version ?? 1);

  return stripCompleteEnvelope(parsed);
}

/** Thrown consumers map to BadRequestException. */
export class TaskExecutionValidationError extends Error {
  constructor(public readonly issues: ZodIssue[]) {
    super('TASK_EXECUTION_VALIDATION_FAILED');
    this.name = 'TaskExecutionValidationError';
  }
}

const SUPPORTED_COMPLETE_VERSIONS = new Set<number>([1]);

export function validateCompleteVersion(version: number): void {
  if (!SUPPORTED_COMPLETE_VERSIONS.has(version)) {
    throw new TaskExecutionValidationError([
      {
        code: 'custom',
        path: ['schema_version'],
        message: `Unsupported schema_version for complete: ${version}`,
      },
    ] as ZodIssue[]);
  }
}
