import { TasksApi } from '../api/tasks';

/** True when the backend has no admin-confirm route (legacy deploy). */
export function isMissingAdminConfirmEndpoint(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405;
}

/** Prefer adminConfirm; fall back to start+complete only when the endpoint is absent. */
export async function adminConfirmOrStartComplete(
  taskId: string,
  body: unknown,
  companyId?: string,
) {
  try {
    return await TasksApi.adminConfirm(taskId, body, companyId);
  } catch (err) {
    if (!isMissingAdminConfirmEndpoint(err)) throw err;
    await TasksApi.start(taskId, undefined, companyId);
    return TasksApi.complete(taskId, body, companyId);
  }
}
