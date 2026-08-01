/**
 * Admin Order Execution dual-mode flag.
 *
 * Default ON. Set VITE_ORDER_WORKSPACE_UI=false for legacy list modals / old detail chrome.
 *
 * When ON:
 * - Create pages plan the order (Admin: dock + putaway / packing; Workers: minimal).
 * - Admin draft details = summary + Print + one Confirm (execute-admin). No task stages.
 * - Worker mode details keep Start workflow → Tasks handoff.
 *
 * Tasks page remains for Worker Execution operators in both flag states.
 */
export function isOrderWorkspaceUiEnabled(): boolean {
  const raw = (import.meta.env.VITE_ORDER_WORKSPACE_UI as string | undefined)?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  return true;
}
