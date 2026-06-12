import type { APIRequestContext } from '@playwright/test';

import { loginInternal, adminApi } from './auth';
import { STAGING } from './constants';
import { WorkflowApi } from './workflow-fixture';

/** Fixed RELEASE-R3 seeded accounts (recreated idempotently in beforeAll). */
export const R3_ACCOUNTS = {
  supervisor: {
    email: 'r3-supervisor@emdad.example',
    fullName: 'R3 Warehouse Supervisor',
    password: STAGING.newUserPassword,
    role: 'wh_manager' as const,
  },
  operator: {
    email: 'r3-operator@emdad.example',
    fullName: 'R3 Warehouse Operator',
    password: STAGING.newUserPassword,
    role: 'wh_operator' as const,
  },
} as const;

export type R3AccountContext = {
  supervisorEmail: string;
  operatorEmail: string;
  operatorWorkerId: string;
  operatorWorkerLabel: string;
  warehouseId: string;
  productId: string;
  productSku: string;
  internalLocationSearch: string;
  quarantineLocationSearch: string;
};

async function findUserByEmail(request: APIRequestContext, token: string, email: string) {
  const res = await adminApi(request, token, 'GET', '/users');
  const body = await res.json();
  const data = body.data ?? body;
  const users = (data.items ?? data ?? []) as Array<{ id: string; email: string }>;
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

async function ensureSystemUser(
  request: APIRequestContext,
  token: string,
  opts: {
    email: string;
    fullName: string;
    password: string;
    systemRole: 'admin' | 'worker';
    workerWarehouseId?: string;
  },
) {
  const existing = await findUserByEmail(request, token, opts.email);
  if (existing) return existing;

  const create = await adminApi(request, token, 'POST', '/users', {
    data: {
      kind: 'system',
      email: opts.email,
      fullName: opts.fullName,
      password: opts.password,
      systemRole: opts.systemRole,
      ...(opts.workerWarehouseId ? { workerWarehouseId: opts.workerWarehouseId } : {}),
    },
  });
  if (create.status() >= 400) {
    const err = await create.json();
    throw new Error(`R3 user create failed (${opts.email}): ${JSON.stringify(err.error ?? err)}`);
  }
  return (await create.json()).data as { id: string; email: string };
}

/**
 * Provision supervisor (wh_manager), operator (wh_operator + worker), and a dedicated QA product.
 * API setup only — workflow steps remain UI-driven in the spec.
 */
export async function ensureR3Accounts(request: APIRequestContext): Promise<R3AccountContext> {
  const session = await loginInternal(request, 'superAdmin');
  const api = new WorkflowApi(request, session.accessToken);
  const locs = await api.getWarehouseAndLocations();

  await ensureSystemUser(request, session.accessToken, {
    email: R3_ACCOUNTS.supervisor.email,
    fullName: R3_ACCOUNTS.supervisor.fullName,
    password: R3_ACCOUNTS.supervisor.password,
    systemRole: 'admin',
  });

  await ensureSystemUser(request, session.accessToken, {
    email: R3_ACCOUNTS.operator.email,
    fullName: R3_ACCOUNTS.operator.fullName,
    password: R3_ACCOUNTS.operator.password,
    systemRole: 'worker',
    workerWarehouseId: locs.warehouseId,
  });

  const workersRes = await api.call('GET', '/workers');
  const workers = (workersRes.json.data ?? []) as Array<{
    id: string;
    displayName?: string;
    user?: { email?: string; fullName?: string };
  }>;
  const operatorWorker =
    workers.find((w) => w.user?.email?.toLowerCase() === R3_ACCOUNTS.operator.email) ?? workers[0];
  if (!operatorWorker?.id) {
    throw new Error('R3 operator worker row not found after provisioning');
  }

  const sku = `R3-E2E-${Date.now().toString(36).toUpperCase()}`;
  const create = await api.call('POST', '/products', {
    companyId: STAGING.companyId,
    name: `QA Product ${sku}`,
    sku,
    uom: 'piece',
    lengthCm: 10,
    widthCm: 10,
    heightCm: 10,
    weightKg: 1,
  });
  if (create.status >= 400) {
    throw new Error(`R3 product create failed: ${JSON.stringify(create.json.error)}`);
  }
  const product = create.json.data;

  const internal = locs.internal;
  const internalLocationSearch =
    internal?.barcode?.slice(0, 6) ||
    internal?.fullPath?.split('/').pop()?.trim().slice(0, 6) ||
    'WH';

  return {
    supervisorEmail: R3_ACCOUNTS.supervisor.email,
    operatorEmail: R3_ACCOUNTS.operator.email,
    operatorWorkerId: operatorWorker.id,
    operatorWorkerLabel:
      operatorWorker.displayName || operatorWorker.user?.fullName || R3_ACCOUNTS.operator.fullName,
    warehouseId: locs.warehouseId,
    productId: product.id,
    productSku: sku,
    internalLocationSearch,
    quarantineLocationSearch:
      locs.quarantine?.barcode?.slice(0, 6) ||
      locs.quarantine?.fullPath?.split('/').pop()?.trim().slice(0, 6) ||
      internalLocationSearch,
  };
}
