import { CarrierShipmentStatus, ShippingMethod } from '@prisma/client';

import { ShippingService } from './shipping.service';

describe('ShippingService.ensureShipmentForOutbound', () => {
  function buildService(overrides: {
    order?: Record<string, unknown> | null;
    created?: Record<string, unknown> | null;
    createShipment?: jest.Mock;
  }) {
    const createShipment =
      overrides.createShipment ?? jest.fn().mockResolvedValue({ awb: 'AWB-1', raw: {} });

    const prisma: any = {
      outboundOrder: {
        findUnique: jest.fn().mockResolvedValue(
          overrides.order === undefined
            ? {
                id: 'out-1',
                companyId: 'co-1',
                status: 'ready_to_ship',
                shippingMethod: ShippingMethod.carrier,
                shippingProviderCode: 'BABEL_EXPRESS',
                trackingNumber: null,
                carrier: null,
                recipientName: 'Ali',
                recipientPhone: '+963999000111',
                shippingPhoneCountry: 'SY',
                destinationAddress: 'Damascus',
                addressLine1: null,
                addressLine2: null,
                district: null,
                city: 'Damascus',
                shippingReceiverLat: 33.5,
                shippingReceiverLng: 36.3,
                shippingPackageType: 'box',
                shippingContents: 'Goods',
                shippingDeliveryType: 'address',
                shippingPickupType: 'address',
                shippingPayer: 'reseller',
                shippingWeightKg: 2,
                paymentMethod: null,
                codAmount: null,
                currency: 'USD',
                orderNumber: 'OUT-1',
                clientReference: null,
                lines: [],
                omsOrder: { id: 'oms-1', orderNumber: 'OMS-1', trackingNumber: null, carrier: null },
              }
            : overrides.order,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      carrierShipment: {
        findFirst: jest.fn().mockResolvedValue(overrides.created ?? null),
        create: jest.fn().mockResolvedValue({ id: 'claim-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      shippingProvider: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prov-1',
          code: 'BABEL_EXPRESS',
          name: 'Babel Express',
          enabled: true,
        }),
      },
      shippingProviderConnection: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'connected',
          encryptedUsername: 'enc-u',
          encryptedPassword: 'enc-p',
        }),
      },
      omsOrder: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
    };

    const encryption = {
      decrypt: jest.fn((v: string) => (v === 'enc-u' ? 'user' : 'pass')),
    };

    const registry = {
      get: jest.fn(() => ({ createShipment })),
      has: jest.fn(() => true),
    };

    const realtime = {
      emitOutboundOrderUpdated: jest.fn(),
    };

    const service = new ShippingService(
      prisma as any,
      encryption as any,
      registry as any,
      realtime as any,
      { lookupBoundary: jest.fn(), containsPoint: jest.fn() } as any,
    );

    return { service, prisma, createShipment, registry };
  }

  it('manual shipping: no carrier API call', async () => {
    const { service, createShipment } = buildService({
      order: {
        id: 'out-1',
        companyId: 'co-1',
        status: 'ready_to_ship',
        shippingMethod: ShippingMethod.manual,
        omsOrder: { id: 'oms-1', orderNumber: 'OMS-1', trackingNumber: null, carrier: null },
        lines: [],
      },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('existing created shipment: no second carrier API call', async () => {
    const { service, createShipment } = buildService({
      created: { id: 'ship-1', status: CarrierShipmentStatus.created, externalAwb: 'AWB-0' },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('existing AWB on outbound: reuses without carrier API call', async () => {
    const { service, createShipment, prisma } = buildService({
      order: {
        id: 'out-1',
        companyId: 'co-1',
        status: 'ready_to_ship',
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        trackingNumber: 'AWB-EXISTING',
        carrier: 'Babel Express',
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'OMS-1',
          trackingNumber: 'AWB-EXISTING',
          carrier: 'Babel Express',
        },
        lines: [],
      },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
    expect(prisma.carrierShipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CarrierShipmentStatus.created,
          externalAwb: 'AWB-EXISTING',
        }),
      }),
    );
  });

  it('pending claim conflict: does not call carrier API', async () => {
    const { service, createShipment, prisma } = buildService({});
    const err = Object.assign(new Error('Unique'), {
      code: 'P2002',
      clientVersion: 'x',
      name: 'PrismaClientKnownRequestError',
    });
    // Make instanceof check work — ShippingService checks Prisma.PrismaClientKnownRequestError
    const { Prisma } = await import('@prisma/client');
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype);
    (err as any).code = 'P2002';
    prisma.carrierShipment.create.mockRejectedValue(err);

    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('happy path: one createShipment and created row', async () => {
    const { service, createShipment, prisma } = buildService({});
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).toHaveBeenCalledTimes(1);
    expect(prisma.carrierShipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CarrierShipmentStatus.pending }),
      }),
    );
    expect(prisma.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CarrierShipmentStatus.created,
          externalAwb: 'AWB-1',
        }),
      }),
    );
    expect(prisma.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'oms-1' },
        data: expect.objectContaining({ trackingNumber: 'AWB-1' }),
      }),
    );
  });

  it('provider failure: marks claim failed and does not ship', async () => {
    const createShipment = jest.fn().mockRejectedValue(new Error('Babel down'));
    const { service, prisma } = buildService({ createShipment });
    await service.ensureShipmentForOutbound('out-1');
    expect(prisma.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CarrierShipmentStatus.failed,
          lastErrorSafe: expect.stringMatching(/Babel down/i),
        }),
      }),
    );
    expect(prisma.outboundOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'shipped' }),
      }),
    );
  });
});
