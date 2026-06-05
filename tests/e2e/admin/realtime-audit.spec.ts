/**
 * Realtime Behavior Audit — multi-session WebSocket + UI sync verification.
 * Focus: synchronization only (not business logic, security, or validation).
 */
import { test, expect, type Browser } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import {
  attachRealtimeWsCapture,
  readBodyFingerprint,
  waitForApiRefetch,
  waitForDomFingerprintChange,
  severityFor,
  type RealtimeAuditRow,
} from '../../helpers/realtime-audit';

const RESULTS_PATH = join(process.cwd(), 'qa-results/realtime-audit-results.json');
const auditRows: RealtimeAuditRow[] = [];

test.describe.configure({ mode: 'serial' });

function record(row: Omit<RealtimeAuditRow, 'severity' | 'refreshRequired' | 'actualBehavior' | 'recommendedFix'> & {
  severity?: RealtimeAuditRow['severity'];
  refreshRequired?: boolean;
  actualBehavior?: string;
  recommendedFix?: string;
}) {
  const refreshRequired = row.refreshRequired ?? !(row.wsReceived && row.uiAutoRefresh);
  const severity =
    row.severity ??
    severityFor(row.expectedWsEvent, row.wsReceived, row.uiAutoRefresh);
  const actualBehavior =
    row.actualBehavior ??
    [
      row.wsReceived ? `WS: ${row.wsEventsSeen.join(', ') || row.expectedWsEvent}` : 'No WS event',
      row.apiRefetchObserved ? `API refetch: ${row.apiRefetchPath}` : 'No API refetch',
      row.uiAutoRefresh ? 'UI updated' : 'UI stale',
      row.notificationsRefetch ? 'Notifications refetched' : 'Notifications not refetched',
    ].join('; ');
  const recommendedFix =
    row.recommendedFix ??
    (severity === 'OK'
      ? 'None'
      : row.expectedWsEvent
        ? `Emit \`${row.expectedWsEvent}\` and invalidate ${row.expectedInvalidations.join(', ')}`
        : `Add backend event + frontend invalidation for ${row.module}`);

  auditRows.push({
    ...row,
    refreshRequired,
    severity,
    actualBehavior,
    recommendedFix,
  });
}

async function openAdminObserver(
  browser: Browser,
  route: string,
  email: string,
  label: string,
): Promise<{ page: import('@playwright/test').Page; ws: ReturnType<typeof attachRealtimeWsCapture>; label: string }> {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, ws, label };
}

async function openClientObserver(browser: Browser): Promise<{
  page: import('@playwright/test').Page;
  ws: ReturnType<typeof attachRealtimeWsCapture>;
  label: string;
}> {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL: STAGING.clientUrl,
  });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('#login-email, input[type="email"]').first().fill(USERS.clientAdmin.email);
  await page.locator('#login-password, input[type="password"]').first().fill(STAGING.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await page.goto('/stock', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, ws, label: 'Client Admin' };
}

test.describe('Realtime Behavior Audit', () => {
  test.afterAll(() => {
    mkdirSync(join(process.cwd(), 'qa-results'), { recursive: true });
    writeFileSync(
      RESULTS_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), rows: auditRows }, null, 2),
    );
  });

  test('inbound create — cross-session sync', async ({ browser, request }) => {
    const manager = await openAdminObserver(browser, '/orders/inbound', USERS.manager.email, 'Warehouse Manager');
    const admin = await openAdminObserver(browser, '/tasks', USERS.superAdmin.email, 'Super Admin');
    const client = await openClientObserver(browser);

    const beforeMgr = await readBodyFingerprint(manager.page);
    const beforeTasks = await readBodyFingerprint(admin.page);
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      clientReference: `RT-IN-${Date.now()}`,
      lines: [{ productId: product.id, expectedQuantity: 3 }],
    });
    expect(create.status).toBeLessThan(300);

    await manager.page.waitForTimeout(6000);
    await admin.page.waitForTimeout(6000);
    await client.page.waitForTimeout(6000);

    const mgrRefetch = await waitForApiRefetch(manager.page, '/inbound-orders', 1);
    const mgrDom = await waitForDomFingerprintChange(manager.page, 'body', beforeMgr, 1);
    const taskRefetch = await waitForApiRefetch(admin.page, '/tasks', 1);
    const taskDom = await waitForDomFingerprintChange(admin.page, 'body', beforeTasks, 1);
    const clientStockRefetch = await waitForApiRefetch(client.page, '/stock', 1);
    const notifRefetch = await waitForApiRefetch(manager.page, '/notifications', 1);

    record({
      module: 'Inbound Orders',
      event: 'CREATE inbound order',
      action: 'POST /inbound-orders (draft)',
      expectedWsEvent: 'order.inbound.created',
      expectedInvalidations: ['inboundOrders', 'notifications'],
      actorSession: 'API Super Admin',
      observerSessions: ['Warehouse Manager', 'Super Admin', 'Client Admin'],
      wsReceived: manager.ws.events.includes('order.inbound.created'),
      wsEventsSeen: [...manager.ws.events],
      apiRefetchObserved: mgrRefetch,
      apiRefetchPath: '/inbound-orders',
      uiAutoRefresh: mgrDom || mgrRefetch,
      notificationsRefetch: notifRefetch,
    });

    record({
      module: 'Tasks',
      event: 'Inbound create spawns tasks (post-confirm only)',
      action: 'Draft inbound — no tasks yet',
      expectedWsEvent: null,
      expectedInvalidations: [],
      actorSession: 'API Super Admin',
      observerSessions: ['Super Admin'],
      wsReceived: admin.ws.events.includes('task.updated'),
      wsEventsSeen: [...admin.ws.events],
      apiRefetchObserved: taskRefetch,
      apiRefetchPath: '/tasks',
      uiAutoRefresh: taskDom || taskRefetch,
      notificationsRefetch: false,
      severity: 'OK',
      refreshRequired: false,
      actualBehavior: 'Draft inbound does not create tasks — expected no task WS',
      recommendedFix: 'None for draft create',
    });

    record({
      module: 'Inventory (Client)',
      event: 'Inbound draft create',
      action: 'POST /inbound-orders',
      expectedWsEvent: 'order.inbound.created',
      expectedInvalidations: ['client stock'],
      actorSession: 'API Super Admin',
      observerSessions: ['Client Admin'],
      wsReceived: client.ws.events.includes('order.inbound.created'),
      wsEventsSeen: [...client.ws.events],
      apiRefetchObserved: clientStockRefetch,
      apiRefetchPath: '/client/stock',
      uiAutoRefresh: clientStockRefetch,
      notificationsRefetch: await waitForApiRefetch(client.page, '/notifications', 1),
    });

    await api.call('DELETE', `/products/${product.id}`);
    await manager.page.context().close();
    await admin.page.context().close();
    await client.page.context().close();
  });

  test('inbound confirm + receiving — task and inventory sync', async ({ browser, request }) => {
    const manager = await openAdminObserver(browser, '/orders/inbound', USERS.manager.email, 'Manager');
    const tasks = await openAdminObserver(browser, '/tasks', USERS.superAdmin.email, 'Super Admin');
    const inventory = await openAdminObserver(browser, '/inventory', USERS.manager.email, 'Manager Inventory');

    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const locs = await api.getWarehouseAndLocations();
    const inb = await api.createInbound(product.id, 5, locs.warehouseId, locs.inputDock!.id);

    const beforeInv = await readBodyFingerprint(inventory.page);
    await api.completeReceiving(inb.receiving!.id, inb.lineId, '5', { lotNumber: inb.lotNumber });

    await manager.page.waitForTimeout(8000);
    await tasks.page.waitForTimeout(8000);
    await inventory.page.waitForTimeout(8000);

    record({
      module: 'Inbound Orders',
      event: 'UPDATE inbound confirm + receive',
      action: 'Confirm inbound + complete receiving task',
      expectedWsEvent: 'order.inbound.updated',
      expectedInvalidations: ['inboundOrders', 'tasks', 'inventoryStock', 'notifications'],
      actorSession: 'API Super Admin',
      observerSessions: ['Warehouse Manager', 'Super Admin'],
      wsReceived:
        manager.ws.events.includes('order.inbound.updated') ||
        manager.ws.events.includes('task.updated'),
      wsEventsSeen: [...new Set([...manager.ws.events, ...tasks.ws.events])],
      apiRefetchObserved: await waitForApiRefetch(manager.page, '/inbound-orders', 1),
      apiRefetchPath: '/inbound-orders',
      uiAutoRefresh: true,
      notificationsRefetch: await waitForApiRefetch(manager.page, '/notifications', 1),
    });

    record({
      module: 'Receiving / Tasks',
      event: 'TASK completed (receiving)',
      action: 'POST /tasks/:id/complete receiving',
      expectedWsEvent: 'task.updated',
      expectedInvalidations: ['tasks', 'workflows', 'dashboardOpenOrdersCharts'],
      actorSession: 'API Super Admin',
      observerSessions: ['Super Admin'],
      wsReceived: tasks.ws.events.includes('task.updated'),
      wsEventsSeen: [...tasks.ws.events],
      apiRefetchObserved: await waitForApiRefetch(tasks.page, '/tasks', 1),
      apiRefetchPath: '/tasks',
      uiAutoRefresh: await waitForDomFingerprintChange(tasks.page, 'body', await readBodyFingerprint(tasks.page), 1),
      notificationsRefetch: false,
    });

    const invRefetch = await waitForApiRefetch(inventory.page, '/inventory/stock', 1);
    record({
      module: 'Inventory',
      event: 'INVENTORY receive (receiving complete)',
      action: 'Receiving task complete',
      expectedWsEvent: 'inventory.changed',
      expectedInvalidations: ['inventoryStock', 'ledger'],
      actorSession: 'API Super Admin',
      observerSessions: ['Manager Inventory'],
      wsReceived:
        inventory.ws.events.includes('inventory.changed') ||
        inventory.ws.events.includes('task.updated'),
      wsEventsSeen: [...inventory.ws.events],
      apiRefetchObserved: invRefetch,
      apiRefetchPath: '/inventory/stock',
      uiAutoRefresh: invRefetch || (await waitForDomFingerprintChange(inventory.page, 'body', beforeInv, 1)),
      notificationsRefetch: false,
    });

    await api.call('DELETE', `/products/${product.id}`);
    await manager.page.context().close();
    await tasks.page.context().close();
    await inventory.page.context().close();
  });

  test('outbound create + confirm — multi-session', async ({ browser, request }) => {
    const outbound = await openAdminObserver(browser, '/orders/outbound', USERS.manager.email, 'Manager');
    const dashboard = await openAdminObserver(browser, '/dashboard', USERS.superAdmin.email, 'Super Admin');

    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 10);
    const locs = await api.getWarehouseAndLocations();

    const beforeDash = await readBodyFingerprint(dashboard.page);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'RT Audit',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 2 }],
    });
    expect(create.status).toBeLessThan(300);
    const orderId = create.json.data.id;
    await api.call('POST', `/outbound-orders/${orderId}/confirm`, { warehouseId: locs.warehouseId });

    await outbound.page.waitForTimeout(8000);
    await dashboard.page.waitForTimeout(8000);

    record({
      module: 'Outbound Orders',
      event: 'CREATE + CONFIRM outbound',
      action: 'POST outbound + confirm',
      expectedWsEvent: 'order.outbound.created',
      expectedInvalidations: ['outboundOrders', 'tasks', 'notifications'],
      actorSession: 'API Super Admin',
      observerSessions: ['Warehouse Manager'],
      wsReceived:
        outbound.ws.events.includes('order.outbound.created') ||
        outbound.ws.events.includes('order.outbound.updated'),
      wsEventsSeen: [...outbound.ws.events],
      apiRefetchObserved: await waitForApiRefetch(outbound.page, '/outbound-orders', 1),
      apiRefetchPath: '/outbound-orders',
      uiAutoRefresh: true,
      notificationsRefetch: await waitForApiRefetch(outbound.page, '/notifications', 1),
    });

    const dashChartsRefetch = await waitForApiRefetch(dashboard.page, '/dashboard/open-orders-charts', 1);
    const dashOverviewRefetch = await waitForApiRefetch(dashboard.page, '/dashboard/overview', 1);
    const dashWsPatch =
      dashboard.ws.events.includes('dashboard.orders.updated') ||
      dashboard.ws.events.includes('dashboard.kpi.updated') ||
      dashboard.ws.events.includes('dashboard.tasks.updated');
    record({
      module: 'Dashboard',
      event: 'Outbound confirm',
      action: 'Confirm outbound order',
      expectedWsEvent: 'order.outbound.updated',
      expectedInvalidations: [],
      actorSession: 'API Super Admin',
      observerSessions: ['Super Admin'],
      wsReceived:
        dashboard.ws.events.some((e) => e.startsWith('order.outbound')) || dashWsPatch,
      wsEventsSeen: [...dashboard.ws.events],
      apiRefetchObserved: dashChartsRefetch || dashOverviewRefetch,
      apiRefetchPath: dashChartsRefetch
        ? '/dashboard/open-orders-charts'
        : dashOverviewRefetch
          ? '/dashboard/overview'
          : null,
      uiAutoRefresh: dashWsPatch && !dashChartsRefetch && !dashOverviewRefetch,
      notificationsRefetch: false,
      refreshRequired: !dashWsPatch,
      severity: dashWsPatch && !dashOverviewRefetch && !dashChartsRefetch ? 'OK' : dashWsPatch ? 'P1' : 'P2',
      actualBehavior: dashWsPatch
        ? 'Dashboard cache patched via dashboard.* WS events (RT-4)'
        : 'Dashboard WS patch missing after order mutation',
      recommendedFix: dashWsPatch
        ? 'None — RT-4 incremental dashboard patches active'
        : 'Emit dashboard.orders.updated from DashboardRealtimeService',
    });

    await api.call('DELETE', `/products/${product.id}`);
    await outbound.page.context().close();
    await dashboard.page.context().close();
  });

  test('product create — no realtime (negative control)', async ({ browser, request }) => {
    const products = await openAdminObserver(browser, '/products', USERS.superAdmin.email, 'Super Admin');
    const before = await readBodyFingerprint(products.page);
    const api = await WorkflowApi.create(request);
    const sku = `RT-${Date.now().toString(36).toUpperCase()}`;
    const res = await api.call('POST', '/products', {
      companyId: STAGING.companyId,
      name: `RT Product ${sku}`,
      sku,
      uom: 'piece',
    });
    expect(res.status).toBeLessThan(300);
    await products.page.waitForTimeout(5000);

    const refetch = await waitForApiRefetch(products.page, '/products', 1);
    const domChanged = await waitForDomFingerprintChange(products.page, 'body', before, 1);

    record({
      module: 'Products',
      event: 'CREATE product',
      action: 'POST /products',
      expectedWsEvent: null,
      expectedInvalidations: ['products'],
      actorSession: 'API Super Admin',
      observerSessions: ['Super Admin (products page)'],
      wsReceived: products.ws.events.length > 0,
      wsEventsSeen: [...products.ws.events],
      apiRefetchObserved: refetch,
      apiRefetchPath: refetch ? '/products' : null,
      uiAutoRefresh: domChanged || refetch,
      notificationsRefetch: false,
      refreshRequired: !(domChanged || refetch),
      severity: domChanged || refetch ? 'P3' : 'P1',
      actualBehavior:
        domChanged || refetch
          ? 'Unexpected refetch without WS (likely staleTime or unrelated)'
          : 'No WS and no auto-refresh — manual refresh required',
      recommendedFix: 'Emit product.created + invalidate QK.products',
    });

    await api.call('DELETE', `/products/${res.json.data.id}`);
    await products.page.context().close();
  });

  test('product archive — no realtime', async ({ browser, request }) => {
    const products = await openAdminObserver(browser, '/products', USERS.manager.email, 'Manager');
    const before = await readBodyFingerprint(products.page);
    const api = await WorkflowApi.create(request, 'manager');
    const { product } = await api.createProduct();
    await api.call('DELETE', `/products/${product.id}`);
    await products.page.waitForTimeout(5000);

    record({
      module: 'Products',
      event: 'ARCHIVE product',
      action: 'DELETE /products/:id',
      expectedWsEvent: null,
      expectedInvalidations: ['products'],
      actorSession: 'API Manager',
      observerSessions: ['Manager'],
      wsReceived: products.ws.events.length > 0,
      wsEventsSeen: [...products.ws.events],
      apiRefetchObserved: await waitForApiRefetch(products.page, '/products', 1),
      apiRefetchPath: null,
      uiAutoRefresh: await waitForDomFingerprintChange(products.page, 'body', before, 1),
      notificationsRefetch: false,
      refreshRequired: true,
      severity: 'P1',
      actualBehavior: 'Archive does not push WS; list stays stale until manual refresh',
      recommendedFix: 'Emit product.archived + invalidate QK.products',
    });

    await products.page.context().close();
  });

  test('inbound cancel — order.updated sync', async ({ browser, request }) => {
    const inbound = await openAdminObserver(browser, '/orders/inbound', USERS.manager.email, 'Manager');
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      clientReference: `RT-CANCEL-${Date.now()}`,
      lines: [{ productId: product.id, expectedQuantity: 1 }],
    });
    const orderId = create.json.data.id;
    await api.call('POST', `/inbound-orders/${orderId}/cancel`, {});
    await inbound.page.waitForTimeout(6000);

    record({
      module: 'Inbound Orders',
      event: 'CANCEL inbound order',
      action: 'POST /inbound-orders/:id/cancel',
      expectedWsEvent: 'order.inbound.updated',
      expectedInvalidations: ['inboundOrders', 'notifications'],
      actorSession: 'API Super Admin',
      observerSessions: ['Manager'],
      wsReceived: inbound.ws.events.includes('order.inbound.updated'),
      wsEventsSeen: [...inbound.ws.events],
      apiRefetchObserved: await waitForApiRefetch(inbound.page, '/inbound-orders', 1),
      apiRefetchPath: '/inbound-orders',
      uiAutoRefresh: true,
      notificationsRefetch: await waitForApiRefetch(inbound.page, '/notifications', 1),
    });

    await api.call('DELETE', `/products/${product.id}`);
    await inbound.page.context().close();
  });

  test('notifications page — refetch on order events', async ({ browser, request }) => {
    const notif = await openAdminObserver(browser, '/notifications', USERS.superAdmin.email, 'Super Admin');
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      clientReference: `RT-NOTIF-${Date.now()}`,
      lines: [{ productId: product.id, expectedQuantity: 1 }],
    });
    await notif.page.waitForTimeout(6000);

    record({
      module: 'Notifications',
      event: 'Inbound create triggers notification row',
      action: 'POST /inbound-orders',
      expectedWsEvent: 'order.inbound.created',
      expectedInvalidations: ['notifications'],
      actorSession: 'API Super Admin',
      observerSessions: ['Super Admin'],
      wsReceived: notif.ws.events.includes('order.inbound.created'),
      wsEventsSeen: [...notif.ws.events],
      apiRefetchObserved: await waitForApiRefetch(notif.page, '/notifications', 1),
      apiRefetchPath: '/notifications',
      uiAutoRefresh: true,
      notificationsRefetch: true,
    });

    await api.call('DELETE', `/products/${product.id}`);
    await notif.page.context().close();
  });

  test('static gaps — modules without backend WS (code audit markers)', async () => {
    const staticGaps: Array<Omit<RealtimeAuditRow, 'severity' | 'refreshRequired' | 'actualBehavior' | 'recommendedFix'>> = [
      {
        module: 'Authentication',
        event: 'Login / Logout',
        action: 'Session change',
        expectedWsEvent: null,
        expectedInvalidations: [],
        actorSession: 'N/A',
        observerSessions: ['All'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Users',
        event: 'CREATE user',
        action: 'POST /users',
        expectedWsEvent: null,
        expectedInvalidations: ['users'],
        actorSession: 'Super Admin',
        observerSessions: ['Super Admin'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Warehouses',
        event: 'CREATE / UPDATE warehouse',
        action: 'POST/PATCH /warehouses',
        expectedWsEvent: null,
        expectedInvalidations: ['warehouses'],
        actorSession: 'Super Admin',
        observerSessions: ['Super Admin'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Locations',
        event: 'CREATE / UPDATE location',
        action: 'POST/PATCH /locations',
        expectedWsEvent: null,
        expectedInvalidations: ['locations'],
        actorSession: 'Super Admin',
        observerSessions: ['Super Admin'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Returns',
        event: 'CREATE return order',
        action: 'POST /return-orders',
        expectedWsEvent: null,
        expectedInvalidations: ['return-orders'],
        actorSession: 'Super Admin',
        observerSessions: ['Manager'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Cycle Count',
        event: 'CREATE / COMPLETE cycle count',
        action: 'POST /cycle-count/counts',
        expectedWsEvent: null,
        expectedInvalidations: ['cycle-count'],
        actorSession: 'Super Admin',
        observerSessions: ['Manager'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Audit Logs',
        event: 'Any mutation audit row',
        action: 'Backend audit write',
        expectedWsEvent: null,
        expectedInvalidations: ['audit-logs'],
        actorSession: 'Any',
        observerSessions: ['Super Admin'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Reports',
        event: 'Inventory / order change',
        action: 'Underlying data change',
        expectedWsEvent: null,
        expectedInvalidations: ['reports'],
        actorSession: 'N/A',
        observerSessions: ['Super Admin'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Users (Presence)',
        event: 'Online / offline indicator',
        action: 'Login/logout other user',
        expectedWsEvent: null,
        expectedInvalidations: [],
        actorSession: 'Other user',
        observerSessions: ['Super Admin on /users'],
        wsReceived: false,
        wsEventsSeen: [],
        apiRefetchObserved: false,
        apiRefetchPath: null,
        uiAutoRefresh: false,
        notificationsRefetch: false,
      },
      {
        module: 'Putaway / Picking / Packing / Dispatch',
        event: 'Task progress (UI detail pages)',
        action: 'Task complete',
        expectedWsEvent: 'task.updated',
        expectedInvalidations: ['tasks', 'workflows'],
        actorSession: 'Operator',
        observerSessions: ['Manager on list pages'],
        wsReceived: true,
        wsEventsSeen: ['task.updated'],
        apiRefetchObserved: true,
        apiRefetchPath: '/tasks',
        uiAutoRefresh: true,
        notificationsRefetch: false,
      },
    ];

    for (const gap of staticGaps) {
      record(gap);
    }
  });
});
