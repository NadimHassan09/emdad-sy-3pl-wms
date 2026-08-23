import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ExternalCreateInboundOrderDto } from './external-create-inbound-order.dto';
import { ExternalCreateOutboundOrderDto } from './external-create-outbound-order.dto';

describe('ExternalCreateInboundOrderDto', () => {
  it('accepts creation-page fields plus externalOrderId', async () => {
    const dto = plainToInstance(ExternalCreateInboundOrderDto, {
      externalOrderId: 'SHOP-INB-1001',
      expectedArrivalDate: '2026-08-25',
      notes: 'Supplier shipment',
      lines: [
        { sku: 'SKU-100', quantity: 10 },
        { sku: 'SKU-200', quantity: 5 },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid externalOrderId charset', async () => {
    const dto = plainToInstance(ExternalCreateInboundOrderDto, {
      externalOrderId: 'INB-طلب-1',
      expectedArrivalDate: '2026-08-25',
      lines: [{ sku: 'SKU-100', quantity: 1 }],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'externalOrderId')).toBe(true);
  });
});

describe('ExternalCreateOutboundOrderDto', () => {
  it('accepts destination + carrier like Create outbound', async () => {
    const dto = plainToInstance(ExternalCreateOutboundOrderDto, {
      externalOrderId: 'SHOP-OUT-1001',
      destination: 'Warehouse A',
      requiredShipDate: '2026-08-25',
      carrier: 'Babel',
      notes: 'Customer shipment',
      lines: [{ sku: 'SKU-100', quantity: 2 }],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.destination).toBe('Warehouse A');
  });

  it('accepts legacy destinationAddress alias', async () => {
    const dto = plainToInstance(ExternalCreateOutboundOrderDto, {
      externalOrderId: 'SHOP-OUT-1002',
      destinationAddress: 'Damascus',
      requiredShipDate: '2026-08-25',
      lines: [{ sku: 'SKU-100', quantity: 1 }],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(String(dto.destination ?? dto.destinationAddress).trim()).toBe('Damascus');
  });

  it('requires destination', async () => {
    const dto = plainToInstance(ExternalCreateOutboundOrderDto, {
      externalOrderId: 'SHOP-OUT-1003',
      requiredShipDate: '2026-08-25',
      lines: [{ sku: 'SKU-100', quantity: 1 }],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'destination')).toBe(true);
  });
});
