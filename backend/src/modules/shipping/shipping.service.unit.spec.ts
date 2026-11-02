import { CarrierShipmentStatus, ShippingMethod } from '@prisma/client';

import { ShippingService } from './shipping.service';

describe('ShippingService.ensureShipmentForOutbound', () => {
  function buildService(overrides: {
    order?: Record<string, unknown> | null;
    created?: Record<string, unknown> | null;
    createShipment?: jest.Mock;
  }) {
    const createShipment =
      overrides.createShipment ??
      jest.fn().mockResolvedValue({ awb: 'AWB-1', trackingNumber: 'AWB-1', raw: {} });

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
                destinationAddress: 'Damascus, Mezzeh Western Villas',
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
                omsOrder: {
                  id: 'oms-1',
                  orderNumber: 'OMS-1',
                  trackingNumber: null,
                  carrier: null,
                  paymentMethod: null,
                  codAmount: null,
                  currency: 'USD',
                },
              }
            : overrides.order,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      carrierShipment: {
        findFirst: jest.fn().mockResolvedValue(overrides.created ?? null),
        findUnique: jest.fn().mockResolvedValue({ id: 'claim-1', rawResultMeta: {} }),
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
      shippingOriginAddress: {
        findUnique: jest.fn().mockResolvedValue({
          contactName: 'Warehouse',
          phone: '+963944000111',
          city: 'Aleppo',
          district: 'Sheikh Najjar',
          street: 'Warehouse street',
          lat: 36.2,
          lng: 37.1,
        }),
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
      { resolveNeighbourhoodId: jest.fn(async () => null) } as any,
      {
        resolveFromAddress: jest.fn(() => ({ found: false })),
        resolveBabelNeighbourhoodId: jest.fn(async () => null),
      } as any,
      { usableRate: jest.fn(async () => null) } as any,
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
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'x',
    });
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
        data: expect.objectContaining({
          trackingNumber: 'AWB-1',
          carrier: 'Babel Express',
          shippingProviderCode: 'BABEL_EXPRESS',
          shippingServiceId: 'BABEL_EXPRESS:address',
        }),
      }),
    );
  });

  it('1. successful Babel submit replaces leftover TARABUT identity', async () => {
    const { service, prisma, createShipment } = buildService({
      order: {
        id: 'out-1',
        companyId: 'co-1',
        status: 'ready_to_ship',
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingServiceId: 'BABEL_EXPRESS:address',
        trackingNumber: 'TARABUT-OLD-AWB',
        carrier: 'ترابط',
        recipientName: 'Ali',
        recipientPhone: '+963999000111',
        shippingPhoneCountry: 'SY',
        destinationAddress: 'Damascus, Mezzeh Western Villas',
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
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'OMS-2026-02291',
          trackingNumber: 'TARABUT-OLD-AWB',
          carrier: 'ترابط',
          shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
          paymentMethod: null,
          codAmount: null,
          currency: 'USD',
        },
      },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).toHaveBeenCalledTimes(1);
    expect(prisma.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrier: 'Babel Express',
          trackingNumber: 'AWB-1',
          shippingProviderCode: 'BABEL_EXPRESS',
          shippingServiceId: 'BABEL_EXPRESS:address',
        }),
      }),
    );
    expect(prisma.outboundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrier: 'Babel Express',
          trackingNumber: 'AWB-1',
          shippingProviderCode: 'BABEL_EXPRESS',
        }),
      }),
    );
  });

  it('4. failed Babel submit does not replace OMS carrier identity', async () => {
    const createShipment = jest.fn().mockRejectedValue(new Error('Babel down'));
    const { service, prisma } = buildService({ createShipment });
    await service.ensureShipmentForOutbound('out-1');
    expect(prisma.omsOrder.update).not.toHaveBeenCalled();
    expect(prisma.outboundOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ carrier: 'Babel Express' }),
      }),
    );
  });

  it('4. ambiguous submit without a confirmed AWB does not replace the active shipment', async () => {
    const createShipment = jest.fn().mockRejectedValue(new Error('timeout waiting for carrier response'));
    const { service, prisma, registry } = buildService({ createShipment });
    registry.get.mockReturnValue({
      createShipment,
      findShipmentByReference: jest.fn().mockResolvedValue(null),
    } as never);
    await service.ensureShipmentForOutbound('out-1');
    expect(prisma.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CarrierShipmentStatus.failed }),
      }),
    );
    expect(prisma.omsOrder.update).not.toHaveBeenCalled();
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

  it('externally_fulfilled outbound: never calls carrier', async () => {
    const { service, createShipment } = buildService({
      order: {
        id: 'out-1',
        companyId: 'co-1',
        status: 'externally_fulfilled',
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        trackingNumber: null,
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'OMS-1',
          trackingNumber: null,
          carrier: null,
          status: 'shipped',
        },
        lines: [],
      },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('OMS shipped + draft outbound: never calls carrier (B7b guard)', async () => {
    const { service, createShipment } = buildService({
      order: {
        id: 'out-1',
        companyId: 'co-1',
        status: 'draft',
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        trackingNumber: null,
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'OMS-1',
          trackingNumber: null,
          carrier: null,
          status: 'shipped',
        },
        lines: [],
      },
    });
    await service.ensureShipmentForOutbound('out-1');
    expect(createShipment).not.toHaveBeenCalled();
  });
});
