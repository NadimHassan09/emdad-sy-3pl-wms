import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { OmsOrdersService } from './oms-orders.service';

describe('Manual Carrier Cost Adjustment', () => {
  const superAdminUser: AuthPrincipal = {
    id: 'user-super-admin',
    email: 'admin@test.com',
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const unauthorizedOperator: AuthPrincipal = {
    id: 'user-op',
    email: 'op@test.com',
    role: 'wh_operator',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  let mockPrisma: any;
  let mockEvents: any;
  let mockRealtime: any;
  let ordersService: OmsOrdersService;
  let shipmentRow: any;
  let orderRow: any;

  beforeEach(() => {
    mockEvents = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockRealtime = {
      emitOmsOrderEvent: jest.fn(),
      emitOutboundOrderUpdated: jest.fn(),
    };

    shipmentRow = {
      id: 'ship-1',
      status: 'created',
      trackingNumber: 'AWB-1',
      externalAwb: 'AWB-1',
      providerCode: 'sena',
      shippingCost: new Prisma.Decimal(10000),
      currency: 'SYP',
      rawResultMeta: {},
      supersededAt: null,
      events: [],
    };

    orderRow = {
      id: 'order-1',
      orderNumber: 'ORD-1001',
      companyId: 'company-1',
      status: 'shipped',
      shippingFee: new Prisma.Decimal(5),
      subtotal: new Prisma.Decimal(105),
      outboundOrderId: 'outbound-1',
      recipientName: 'Nadim Hassan',
      recipientPhone: '0999999999',
      city: 'Aleppo',
      currency: 'USD',
      codAmount: null,
      shippingReceiverLat: null,
      shippingReceiverLng: null,
      babelNeighbourhoodId: null,
      shippingWeightKg: null,
      lines: [],
      omsReturns: [],
      company: { id: 'company-1', name: 'Test company' },
      outboundOrder: {
        id: 'outbound-1',
        orderNumber: 'OUT-1',
        status: 'shipped',
        carrier: 'sena',
        shippingProviderCode: 'sena',
        shippingServiceId: null,
        shippingHubId: null,
        shippingMethod: 'carrier',
        trackingNumber: 'AWB-1',
        carrierShipments: [shipmentRow],
      },
    };

    mockPrisma = {
      omsOrder: {
        findUnique: jest.fn().mockResolvedValue(orderRow),
      },
      carrierShipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: shipmentRow.id,
          providerCode: shipmentRow.providerCode,
          shippingCost: shipmentRow.shippingCost,
          currency: shipmentRow.currency,
          rawResultMeta: shipmentRow.rawResultMeta,
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          shipmentRow.rawResultMeta = data.rawResultMeta;
          shipmentRow.shippingCostSource = data.shippingCostSource;
          return Promise.resolve(shipmentRow);
        }),
      },
      carrierCostChange: {
        create: jest.fn().mockResolvedValue({ id: 'cc-1' }),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
    };

    ordersService = new OmsOrdersService(
      mockPrisma as any,
      {} as any, // outbound
      {} as any, // companyAccess
      {} as any, // allocation
      mockEvents as any, // events
      {} as any, // sync
      mockRealtime as any, // realtime
      {} as any, // cod
      {} as any, // shipping
      {} as any, // shippingTracking
      {} as any, // geo
      {} as any, // autoReturn
      {} as any, // shippingFees
      {} as any, // billingAccess
      {} as any, // omsReturns
    );
  });

  it('happy path: updates meta, records audit, returns order', async () => {
    const res = await ordersService.adjustCarrierCost(superAdminUser, 'order-1', {
      carrierCostUsd: 3.5,
      reason: 'carrier billed more',
    });

    expect(mockPrisma.carrierShipment.update).toHaveBeenCalled();
    expect(mockPrisma.carrierCostChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: expect.anything(),
          currency: 'USD',
          source: 'manual',
        }),
      }),
    );
    expect(mockEvents.record).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        eventType: 'oms.carrier_cost_adjusted',
        payload: expect.objectContaining({
          newCarrierCostUsd: '3.5000',
          reason: 'carrier billed more',
        }),
      }),
    );
    expect(res.id).toBe('order-1');
    expect(res.carrierCostUsd).toBe('3.5000');
  });

  it('rejects non-admin', async () => {
    await expect(
      ordersService.adjustCarrierCost(unauthorizedOperator, 'order-1', { carrierCostUsd: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects negative value', async () => {
    await expect(
      ordersService.adjustCarrierCost(superAdminUser, 'order-1', { carrierCostUsd: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 400 when order has no shipment', async () => {
    orderRow.outboundOrder.carrierShipments = [];
    await expect(
      ordersService.adjustCarrierCost(superAdminUser, 'order-1', { carrierCostUsd: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when order missing', async () => {
    mockPrisma.omsOrder.findUnique.mockResolvedValue(null);
    await expect(
      ordersService.adjustCarrierCost(superAdminUser, 'missing', { carrierCostUsd: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
