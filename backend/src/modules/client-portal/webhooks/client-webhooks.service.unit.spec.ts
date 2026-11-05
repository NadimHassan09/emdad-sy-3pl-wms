import { ClientWebhooksService } from './client-webhooks.service';
import { verifyWebhookSignature } from './webhook-security.util';

const SECRET = 'whsec_test';
const encryption = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.replace('enc:', '') };

function build(opts: { orders?: any[]; states?: any[]; endpointCreatedAt?: Date }) {
  const deliveries: any[] = [];
  const updates: any[] = [];
  const endpoint = {
    id: 'ep1', companyId: 'c1', url: 'https://8.8.8.8/hook', secretEnc: `enc:${SECRET}`, isActive: true,
    consecutiveFailures: 0, cursorAt: new Date('2026-01-01'), createdAt: opts.endpointCreatedAt ?? new Date('2026-01-01'),
  };
  const prisma: any = {
    clientWebhookEndpoint: { findMany: async () => [endpoint], update: async (a: any) => updates.push(['endpoint', a.data]) },
    omsOrder: { findMany: async () => opts.orders ?? [] },
    clientWebhookOrderState: { findMany: async () => opts.states ?? [], upsert: async () => undefined },
    clientWebhookDelivery: {
      create: async (a: any) => { deliveries.push(a.data); return a.data; },
      findMany: async () => deliveries.map((d) => ({ ...d, attempts: 0, endpoint })),
      update: async (a: any) => updates.push(['delivery', a.data]),
    },
  };
  return { service: new ClientWebhooksService(prisma, encryption as any), deliveries, updates };
}

const order = (over: any) => ({
  id: 'o1', orderNumber: 'OMS-1', status: 'confirmed', codStatus: null,
  createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-02-02'), ...over,
});

describe('ClientWebhooksService', () => {
  it('queues order.created for a new order and nothing when the status did not change', async () => {
    const a = build({ orders: [order({})] });
    expect(await a.service.scanChanges()).toBe(1);
    expect(a.deliveries[0].event).toBe('order.created');

    const b = build({ orders: [order({})], states: [{ orderId: 'o1', lastStatus: 'confirmed' }] });
    expect(await b.service.scanChanges()).toBe(0);
  });

  it('queues a status change with the previous status', async () => {
    const { service, deliveries } = build({ orders: [order({ status: 'shipped' })], states: [{ orderId: 'o1', lastStatus: 'confirmed' }] });
    await service.scanChanges();
    expect(deliveries[0]).toMatchObject({ event: 'order.status_changed' });
    expect(deliveries[0].payload).toMatchObject({ previousStatus: 'confirmed', status: 'shipped' });
  });

  it('delivers with a valid signature and marks the delivery delivered', async () => {
    const { service, updates } = build({ orders: [order({})] });
    await service.scanChanges();
    let seen: { body: string; sig: string } | null = null;
    service.fetchImpl = (async (_u: any, init: any) => {
      seen = { body: init.body, sig: init.headers['X-Emdad-Signature'] };
      return { status: 200 } as Response;
    }) as any;
    await service.deliverDue();
    expect(verifyWebhookSignature(SECRET, seen!.body, seen!.sig)).toBe(true);
    expect(updates.find((u) => u[0] === 'delivery')![1]).toMatchObject({ status: 'delivered', attempts: 1 });
  });

  it('schedules a retry after a failure and records the endpoint failure', async () => {
    const { service, updates } = build({ orders: [order({})] });
    await service.scanChanges();
    service.fetchImpl = (async () => ({ status: 500 }) as Response) as any;
    await service.deliverDue();
    expect(updates.find((u) => u[0] === 'delivery')![1]).toMatchObject({ status: 'pending', attempts: 1, lastHttpStatus: 500 });
    expect(updates.filter((u) => u[0] === 'endpoint').pop()![1]).toMatchObject({ consecutiveFailures: 1 });
  });
});
