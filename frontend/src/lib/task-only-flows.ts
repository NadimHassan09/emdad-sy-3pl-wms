/** Mirrors backend `TASK_ONLY_FLOWS` for UI (staging map, timeline, hid legacy receive shortcuts). */
export function taskOnlyFlowsUi(): boolean {
  const v = (import.meta.env.VITE_TASK_ONLY_FLOWS as string | undefined)?.trim().toLowerCase();
  return v === 'true' || v === '1';
}
