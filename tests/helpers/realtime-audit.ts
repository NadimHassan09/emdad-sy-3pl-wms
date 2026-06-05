import type { Page } from '@playwright/test';

/** Must match backend `realtime.events.ts` and frontend `realtime/constants.ts`. */
export const REALTIME_EVENT_NAMES = [
  'order.inbound.created',
  'order.inbound.updated',
  'order.outbound.created',
  'order.outbound.updated',
  'task.updated',
  'inventory.changed',
  'product.created',
  'product.updated',
  'product.archived',
  'product.deleted',
  'user.created',
  'user.updated',
  'user.deleted',
  'warehouse.created',
  'warehouse.updated',
  'location.created',
  'location.updated',
  'location.archived',
  'return.created',
  'return.updated',
  'return.confirmed',
  'return.completed',
  'cycle_count.created',
  'cycle_count.updated',
  'cycle_count.completed',
  'adjustment.created',
  'adjustment.approved',
  'transfer.created',
  'transfer.completed',
  'audit_log.created',
  'notification.created',
  'notification.read',
  'notification.deleted',
  'dashboard.kpi.updated',
  'dashboard.inventory.updated',
  'dashboard.orders.updated',
  'dashboard.tasks.updated',
  'presence.online',
  'presence.offline',
  'auth.session.changed',
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENT_NAMES)[number];

export type RealtimeAuditRow = {
  module: string;
  event: string;
  action: string;
  expectedWsEvent: string | null;
  expectedInvalidations: string[];
  actorSession: string;
  observerSessions: string[];
  wsReceived: boolean;
  wsEventsSeen: string[];
  apiRefetchObserved: boolean;
  apiRefetchPath: string | null;
  uiAutoRefresh: boolean;
  notificationsRefetch: boolean;
  refreshRequired: boolean;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'OK';
  actualBehavior: string;
  recommendedFix: string;
};

export type RealtimeWsCapture = {
  events: RealtimeEventName[];
  connected: boolean;
};

/** Attach Socket.IO frame listener; parses `42["event.name",…]` payloads. */
export function attachRealtimeWsCapture(page: Page): RealtimeWsCapture {
  const capture: RealtimeWsCapture = { events: [], connected: false };

  page.on('websocket', (ws) => {
    const url = ws.url();
    if (!url.includes('/realtime') && !url.includes('socket.io')) return;
    capture.connected = true;
    ws.on('framereceived', (frame) => {
      const raw = frame.payload.toString();
      for (const name of REALTIME_EVENT_NAMES) {
        if (raw.includes(name)) {
          if (!capture.events.includes(name)) capture.events.push(name);
        }
      }
    });
  });

  return capture;
}

/** Wait for a GET refetch on observer after mutation (TanStack Query invalidation signal). */
export async function waitForApiRefetch(
  page: Page,
  pathFragment: string,
  timeoutMs = 10_000,
): Promise<boolean> {
  try {
    await page.waitForResponse(
      (resp) =>
        resp.request().method() === 'GET' &&
        resp.url().includes(pathFragment) &&
        resp.status() < 500,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

/** Detect list/table content change without full page reload. */
export async function waitForDomFingerprintChange(
  page: Page,
  selector: string,
  before: string,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = await page.locator(selector).first().innerText().catch(() => '');
    if (now !== before && now.length > 0) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

export async function readBodyFingerprint(page: Page): Promise<string> {
  return page.locator('main, [role="main"], .page-content, body').first().innerText().catch(() => '');
}

export function severityFor(
  expectedWs: string | null,
  wsReceived: boolean,
  uiAutoRefresh: boolean,
): RealtimeAuditRow['severity'] {
  if (expectedWs === null) {
    return uiAutoRefresh ? 'OK' : 'P3';
  }
  if (wsReceived && uiAutoRefresh) return 'OK';
  if (wsReceived && !uiAutoRefresh) return 'P1';
  if (!wsReceived && !uiAutoRefresh) return 'P0';
  return 'P2';
}
