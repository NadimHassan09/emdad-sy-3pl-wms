export type TaskAssignmentLike = {
  worker?: {
    id?: string;
    displayName?: string | null;
    user?: { fullName?: string | null; email?: string | null } | null;
  } | null;
} | null;

/** Label for the active task assignee (handles empty display_name in DB). */
export function taskAssignedWorkerLabel(assignments?: TaskAssignmentLike[] | null): string {
  const w = assignments?.[0]?.worker;
  if (!w) return '—';
  const dn = w.displayName?.trim();
  if (dn) return dn;
  const fn = w.user?.fullName?.trim();
  if (fn) return fn;
  const em = w.user?.email?.trim();
  if (em) return em;
  if (w.id) return `${w.id.slice(0, 8)}…`;
  return '—';
}
