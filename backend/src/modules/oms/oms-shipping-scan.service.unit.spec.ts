import { BadRequestException } from '@nestjs/common';

import { OmsShippingScanService } from './oms-shipping-scan.service';
import type { AuthPrincipal } from '../../common/auth/current-user.types';

describe('OmsShippingScanService', () => {
  const user: AuthPrincipal = {
    id: 'user-1',
    companyId: 'comp-1',
    role: 'wh_operator',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['comp-1'],
  };

  let prisma: any;
  let outbound: any;
  let service: OmsShippingScanService;

  const activeShipment = {
    id: 'ship-1',
    status: 'created',
    supersededAt: null,
    trackingNumber: 'AWB-1',
    externalAwb: 'cargo-1',
    providerCode: 'SILA_SY',
    outboundOrderId: 'out-1',
  };

  function orderRow(overrides?: {
    omsStatus?: string;
    outboundStatus?: string;
    shipments?: unknown[];
  }) {
    return {
      id: 'oms-1',
      orderNumber: 'OMS-1',
      status: overrides?.omsStatus ?? 'processing',
      companyId: 'comp-1',
      outboundOrder: {
        id: 'out-1',
        status: overrides?.outboundStatus ?? 'waiting_for_shipping_details',
        shippingProviderCode: 'SILA_SY',
        carrierShipments: overrides?.shipments ?? [activeShipment],
      },
    };
  }

  beforeEach(() => {
    prisma = {
      carrierShipment: { findFirst: jest.fn() },
      omsOrder: { findFirst: jest.fn() },
    };
    outbound = {
      completeShippingDetailsAdmin: jest.fn().mockResolvedValue({ status: 'ready_to_ship' }),
      completeDispatchAdmin: jest.fn().mockResolvedValue({ status: 'shipped' }),
    };
    service = new OmsShippingScanService(prisma, outbound);
  });

  it('2. Waiting for Shipping Confirmation → Ready to Ship via valid QR', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce(activeShipment);
    prisma.omsOrder.findFirst.mockResolvedValueOnce(orderRow());
    const res = await service.apply(user, 'AWB-1', 'ready_to_ship');
    expect(res.ok).toBe(true);
    expect(res.alreadyApplied).toBe(false);
    expect(outbound.completeShippingDetailsAdmin).toHaveBeenCalledWith(user, 'out-1');
  });

  it('3. Ready to Ship → Out for Delivery via physical handover QR', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce(activeShipment);
    prisma.omsOrder.findFirst.mockResolvedValueOnce(
      orderRow({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
    );
    const res = await service.apply(user, 'OMS-1', 'handover');
    expect(res.ok).toBe(true);
    expect(res.alreadyApplied).toBe(false);
    expect(outbound.completeDispatchAdmin).toHaveBeenCalledWith(user, 'out-1');
  });

  it('4. repeated QR scans do not duplicate transitions', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValue(activeShipment);
    prisma.omsOrder.findFirst
      .mockResolvedValueOnce(orderRow())
      .mockResolvedValueOnce(
        orderRow({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
      );
    const first = await service.apply(user, 'AWB-1', 'ready_to_ship');
    const second = await service.apply(user, 'AWB-1', 'ready_to_ship');
    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(outbound.completeShippingDetailsAdmin).toHaveBeenCalledTimes(1);

    prisma.omsOrder.findFirst
      .mockResolvedValueOnce(
        orderRow({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
      )
      .mockResolvedValueOnce(orderRow({ omsStatus: 'shipped', outboundStatus: 'shipped' }));
    const hand1 = await service.apply(user, 'AWB-1', 'handover');
    const hand2 = await service.apply(user, 'AWB-1', 'handover');
    expect(hand1.alreadyApplied).toBe(false);
    expect(hand2.alreadyApplied).toBe(true);
    expect(outbound.completeDispatchAdmin).toHaveBeenCalledTimes(1);
  });

  it('5. cancelled/superseded shipment QR cannot affect the active order', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce({
      ...activeShipment,
      id: 'ship-old',
      status: 'failed',
      supersededAt: new Date(),
      trackingNumber: 'OLD-AWB',
    });
    await expect(service.apply(user, 'OLD-AWB', 'ready_to_ship')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(outbound.completeShippingDetailsAdmin).not.toHaveBeenCalled();
    expect(outbound.completeDispatchAdmin).not.toHaveBeenCalled();
    expect(prisma.omsOrder.findFirst).not.toHaveBeenCalled();
  });
});
