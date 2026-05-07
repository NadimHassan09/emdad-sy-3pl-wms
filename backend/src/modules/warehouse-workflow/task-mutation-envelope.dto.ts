
/**
 * Standard mutation response envelope for patching React Query `tasks.detail`,
 * `workflows.instance`, and optional order summary caches (`setQueryData`).
 */
export interface TaskMutationResponseEnvelope {
  task: unknown;
  workflowInstance: Record<string, unknown> | null;
  assignments?: unknown[];
  orderSummary?:
    | { kind: 'inbound'; id: string; orderNumber: string; status: string }
    | { kind: 'outbound'; id: string; orderNumber: string; status: string };
}
