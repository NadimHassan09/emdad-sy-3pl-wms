import { isOrderWorkspaceUiEnabled } from '../lib/order-workspace-mode';

/** See `order-workspace-mode.ts` — default ON (order_workspace); set VITE_ORDER_WORKSPACE_UI=false for task_first. */
export function useOrderWorkspaceMode(): boolean {
  return isOrderWorkspaceUiEnabled();
}
