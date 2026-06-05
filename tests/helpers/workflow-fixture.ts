import type { APIRequestContext } from '@playwright/test';

import { STAGING } from './constants';
import { authHeaders, loginInternal } from './auth';

export const DEFAULT_WORKER_ID = 'd5e94ab0-07ce-49f7-91fe-05076b00b564';

type ApiJson = { success?: boolean; data?: any; error?: { message?: string; code?: string } };

export class WorkflowApi {
  token: string;
  private workerIdCache: string | null = null;

  constructor(
    private request: APIRequestContext,
    token: string,
  ) {
    this.token = token;
  }

  static async create(request: APIRequestContext, user: 'superAdmin' | 'manager' = 'superAdmin') {
    const session = await loginInternal(request, user);
    return new WorkflowApi(request, session.accessToken);
  }

  async call<T = ApiJson>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    companyId = STAGING.companyId,
  ) {
    const res = await this.request.fetch(`${STAGING.adminUrl}/api${path}`, {
      method,
      headers: authHeaders(this.token, companyId),
      data: body,
    });
    const json = (await res.json()) as T;
    return { status: res.status(), json };
  }

  async getWarehouseAndLocations() {
    const whRes = await this.call('GET', '/warehouses');
    const warehouseId = whRes.json.data?.[0]?.id ?? whRes.json.data?.items?.[0]?.id;
    const locRes = await this.call('GET', `/locations?warehouseId=${warehouseId}`);
    const locations = locRes.json.data?.items ?? locRes.json.data ?? [];
    return {
      warehouseId,
      inputDock: locations.find((l: { type: string }) => l.type === 'input'),
      internal: locations.find((l: { type: string }) => l.type === 'internal'),
      quarantine: locations.find((l: { type: string }) => l.type === 'quarantine'),
      locations,
    };
  }

  async createProduct(sku?: string) {
    const s = (sku ?? `QA-${Date.now().toString(36)}`).toUpperCase();
    const res = await this.call('POST', '/products', {
      companyId: STAGING.companyId,
      name: `QA Product ${s}`,
      sku: s,
      uom: 'piece',
    });
    return { res, product: res.json.data, sku: s };
  }

  async createInbound(productId: string, qty: number, warehouseId: string, stagingLocId: string) {
    const create = await this.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      clientReference: `QA-IN-${Date.now()}`,
      lines: [{ productId, expectedQuantity: qty }],
    });
    const order = create.json.data;
    const lineId = order.lines[0].id;
    const confirm = await this.call('POST', `/inbound-orders/${order.id}/confirm`, {
      warehouseId,
      stagingByLineId: { [lineId]: stagingLocId },
    });
    if (confirm.status >= 400) {
      throw new Error(`Inbound confirm failed: ${confirm.status} ${JSON.stringify(confirm.json.error)}`);
    }
    let tasks: any[] = [];
    for (let i = 0; i < 5; i++) {
      tasks = await this.getTasksByReference(order.id);
      if (tasks.some((t) => t.taskType === 'receiving')) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const receiving = tasks.find((t) => t.taskType === 'receiving');
    return { order, lineId, receiving, confirm, lotNumber: order.lines[0].expectedLotNumber };
  }

  async getTasksByReference(referenceId: string) {
    const res = await this.call('GET', `/tasks?referenceId=${referenceId}&limit=50`);
    return res.json.data?.items ?? res.json.data ?? [];
  }

  async ensureWorkerId(): Promise<string> {
    if (this.workerIdCache) return this.workerIdCache;
    const list = await this.call('GET', '/workers');
    const workers = (list.json.data ?? []) as Array<{ id: string }>;
    if (workers.length > 0) {
      this.workerIdCache = workers[0].id;
      return this.workerIdCache;
    }
    const locs = await this.getWarehouseAndLocations();
    const email = `qa-wf-worker-${Date.now()}@emdad.example`;
    const created = await this.call('POST', '/users', {
      kind: 'system',
      email,
      fullName: 'QA Workflow Worker',
      password: STAGING.newUserPassword,
      systemRole: 'worker',
      workerWarehouseId: locs.warehouseId,
    });
    if (created.status >= 400) {
      throw new Error(`Worker user create failed: ${created.status} ${JSON.stringify(created.json.error)}`);
    }
    const refreshed = await this.call('GET', '/workers');
    const row = ((refreshed.json.data ?? []) as Array<{ id: string }>)[0];
    if (!row?.id) throw new Error('Worker not provisioned after user create');
    this.workerIdCache = row.id;
    return row.id;
  }

  async assignStart(taskId: string, workerId?: string) {
    const resolvedWorkerId = workerId ?? (await this.ensureWorkerId());
    const assign = await this.call('POST', `/tasks/${taskId}/assign`, { workerId: resolvedWorkerId });
    if (assign.status >= 400) {
      throw new Error(`Task assign failed: ${assign.status} ${JSON.stringify(assign.json.error)}`);
    }
    const start = await this.call('POST', `/tasks/${taskId}/start`, {});
    if (start.status >= 400) {
      throw new Error(`Task start failed: ${start.status} ${JSON.stringify(start.json.error)}`);
    }
    return start;
  }

  async completeReceiving(
    taskId: string,
    lineId: string,
    receivedQty: string,
    opts?: { lotNumber?: string; allowShortClose?: boolean },
  ) {
    await this.assignStart(taskId);
    return this.call('POST', `/tasks/${taskId}/complete`, {
      task_type: 'receiving',
      ...(opts?.allowShortClose ? { allow_short_close: true, short_close_reason_code: 'not_found' } : {}),
      lines: [
        {
          inbound_order_line_id: lineId,
          received_qty: receivedQty,
          ...(opts?.lotNumber ? { capture_lot_number: opts.lotNumber } : {}),
        },
      ],
    });
  }

  async completePutaway(
    taskId: string,
    lineId: string,
    qty: string,
    destinationLocationId: string,
    taskType: 'putaway' | 'putaway_quarantine' = 'putaway',
  ) {
    await this.assignStart(taskId);
    return this.call('POST', `/tasks/${taskId}/complete`, {
      task_type: taskType,
      lines: [{ inbound_order_line_id: lineId, putaway_quantity: qty, destination_location_id: destinationLocationId }],
    });
  }

  async getStock(productId?: string) {
    const q = productId ? `?productId=${productId}&limit=100` : '?limit=100';
    const res = await this.call('GET', `/inventory/stock${q}`);
    return res.json.data?.items ?? res.json.data ?? [];
  }

  async createOutbound(productId: string, qty: number, warehouseId: string) {
    const create = await this.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'QA Test Destination',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId, requestedQuantity: qty }],
    });
    const order = create.json.data;
    const lineId = order.lines[0].id;
    await this.call('POST', `/outbound-orders/${order.id}/confirm`, { warehouseId });
    const tasks = await this.getTasksByReference(order.id);
    return { order, lineId, pick: tasks.find((t) => t.taskType === 'pick') };
  }

  async completePick(taskId: string, lineId: string, locationId: string, lotId: string | null, qty: string) {
    await this.assignStart(taskId);
    return this.call('POST', `/tasks/${taskId}/complete`, {
      task_type: 'pick',
      picks: [{ outbound_order_line_id: lineId, lines: [{ location_id: locationId, lot_id: lotId, quantity: qty }] }],
    });
  }

  async completePack(taskId: string, lineId: string, qty: string) {
    await this.assignStart(taskId);
    return this.call('POST', `/tasks/${taskId}/complete`, {
      task_type: 'pack',
      lines: [{ outbound_order_line_id: lineId, packed_qty: qty }],
    });
  }

  async completeDispatch(taskId: string, lineId: string, qty: string) {
    await this.assignStart(taskId);
    return this.call('POST', `/tasks/${taskId}/complete`, {
      task_type: 'dispatch',
      lines: [{ outbound_order_line_id: lineId, ship_qty: qty }],
    });
  }

  async getAuditLogs(opts?: { limit?: number; action?: string; resourceType?: string; companyId?: string }) {
    const params = new URLSearchParams();
    params.set('limit', String(opts?.limit ?? 50));
    if (opts?.action) params.set('action', opts.action);
    if (opts?.resourceType) params.set('resource_type', opts.resourceType);
    if (opts?.companyId) params.set('company_id', opts.companyId);
    return this.call('GET', `/audit-logs?${params}`);
  }

  async seedStock(productId: string, qty: number) {
    const locs = await this.getWarehouseAndLocations();
    const inb = await this.createInbound(productId, qty, locs.warehouseId, locs.inputDock!.id);
    if (!inb.receiving) throw new Error('Receiving task not created');
    const recv = await this.completeReceiving(inb.receiving.id, inb.lineId, String(qty), {
      lotNumber: inb.lotNumber,
    });
    if (recv.status >= 400) {
      throw new Error(`Receiving complete failed: ${recv.status} ${JSON.stringify(recv.json.error)}`);
    }
    let put: { id: string; taskType: string } | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      const tasks = await this.getTasksByReference(inb.order.id);
      put = tasks.find(
        (t) => t.taskType === 'putaway' || t.taskType === 'putaway_quarantine',
      );
      if (put) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!put) throw new Error('Putaway task not created');
    const dest =
      put.taskType === 'putaway_quarantine'
        ? locs.quarantine?.id ?? locs.internal!.id
        : locs.internal!.id;
    await this.completePutaway(
      put.id,
      inb.lineId,
      String(qty),
      dest,
      put.taskType === 'putaway_quarantine' ? 'putaway_quarantine' : 'putaway',
    );
    const stock = await this.getStock(productId);
    return { locs, stock, inb };
  }

  async shipOutbound(productId: string, qty: number, warehouseId: string) {
    const stock = await this.getStock(productId);
    const out = await this.createOutbound(productId, qty, warehouseId);
    await this.completePick(out.pick!.id, out.lineId, stock[0].locationId, stock[0].lotId, String(qty));
    const tasks = await this.getTasksByReference(out.order.id);
    const pack = tasks.find((t) => t.taskType === 'pack');
    if (pack && pack.status !== 'completed') {
      await this.completePack(pack.id, out.lineId, String(qty));
    }
    const disp = (await this.getTasksByReference(out.order.id)).find((t) => t.taskType === 'dispatch');
    if (!disp) throw new Error('Dispatch task not created');
    await this.completeDispatch(disp.id, out.lineId, String(qty));
    return { out, stock: stock[0] };
  }

  async runReturnLifecycle(productId: string, qty: number) {
    const locs = await this.getWarehouseAndLocations();
    await this.seedStock(productId, qty + 2);
    const { out, stock } = await this.shipOutbound(productId, qty, locs.warehouseId);
    const create = await this.call('POST', '/return-orders', {
      warehouseId: locs.warehouseId,
      originalOutboundOrderId: out.order.id,
      lines: [{ productId, expectedQuantity: qty, lotId: stock.lotId }],
    });
    if (create.status >= 400) throw new Error(`Return create failed: ${JSON.stringify(create.json.error)}`);
    const ret = create.json.data;
    const lineId = ret.lines[0].id;
    await this.call('POST', `/return-orders/${ret.id}/confirm`);
    await this.call('POST', `/return-orders/${ret.id}/start-receiving`);
    await this.call('POST', `/return-orders/${ret.id}/lines/${lineId}/receive`, { quantity: qty, condition: 'good' });
    await this.call('POST', `/return-orders/${ret.id}/lines/${lineId}/inspect`, {
      condition: 'good',
      disposition: 'restock',
      targetLocationId: locs.internal!.id,
    });
    await this.call('POST', `/return-orders/${ret.id}/lines/${lineId}/apply-disposition`, {
      disposition: 'restock',
      targetLocationId: locs.internal!.id,
    });
    const post = await this.call('POST', `/return-orders/${ret.id}/post-inventory`);
    const complete = await this.call('POST', `/return-orders/${ret.id}/complete`);
    return { ret, lineId, post, complete, locs };
  }

  async cancelActiveCycleCounts(warehouseId: string) {
    const res = await this.call('GET', `/cycle-count/counts?warehouseId=${warehouseId}&limit=50`);
    const counts = res.json.data?.items ?? res.json.data ?? [];
    for (const c of counts) {
      if (!['completed', 'cancelled'].includes(String(c.status))) {
        await this.call('POST', `/cycle-count/counts/${c.id}/cancel`);
      }
    }
  }

  async runCycleCountExecution(productId: string) {
    const locs = await this.getWarehouseAndLocations();
    await this.seedStock(productId, 5);
    await this.cancelActiveCycleCounts(locs.warehouseId);
    const create = await this.call('POST', '/cycle-count/counts', {
      warehouseId: locs.warehouseId,
      productIds: [productId],
      notes: 'QA cycle count execution',
    });
    if (create.status >= 400) throw new Error(`Cycle count create failed: ${JSON.stringify(create.json.error)}`);
    const count = create.json.data;
    const lineId = count.lines[0].id;
    await this.call('POST', `/cycle-count/counts/${count.id}/start`);
    await this.call('PATCH', `/cycle-count/counts/${count.id}/assign`, {
      assignedWorkerId: await this.ensureWorkerId(),
    });
    await this.call('POST', `/cycle-count/counts/${count.id}/lines/${lineId}/count`, { actualQuantity: '5' });
    const review = await this.call('POST', `/cycle-count/counts/${count.id}/submit-review`);
    const reconcile = await this.call('POST', `/cycle-count/counts/${count.id}/reconcile`);
    const postRecon = await this.call('POST', `/cycle-count/counts/${count.id}/post-reconciliation`);
    const complete = await this.call('POST', `/cycle-count/counts/${count.id}/complete`);
    const history = await this.call(
      'GET',
      `/cycle-count/product-history?productId=${productId}&warehouseId=${locs.warehouseId}`,
    );
    return { count, lineId, review, reconcile, postRecon, complete, history, locs };
  }
}

export function assertStockIntegrity(rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const onHand = parseFloat(String(row.quantityOnHand ?? row.quantity_on_hand ?? 0));
    const reserved = parseFloat(String(row.quantityReserved ?? row.quantity_reserved ?? 0));
    const available = parseFloat(String(row.quantityAvailable ?? row.quantity_available ?? 0));
    if (onHand < 0) throw new Error(`Negative on-hand at location ${row.locationId}`);
    if (reserved < 0) throw new Error(`Negative reserved at location ${row.locationId}`);
    if (reserved > onHand) throw new Error(`Reserved > on-hand at location ${row.locationId}`);
    if (Math.abs(available - (onHand - reserved)) > 0.0001) {
      throw new Error(`Available mismatch at location ${row.locationId}: ${available} != ${onHand - reserved}`);
    }
  }
}
