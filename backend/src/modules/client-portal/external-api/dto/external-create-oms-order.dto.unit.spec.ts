import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ExternalCreateOmsOrderDto } from './external-create-oms-order.dto';

describe('ExternalCreateOmsOrderDto', () => {
  it('rejects missing address and SKU lines', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      externalOrderId: 'SHOP-1',
      requiredShipDate: '2026-08-25',
      lines: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'address' || e.property === 'lines')).toBe(true);
  });

  it('accepts a valid OMS payload using SKU not productId', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      externalOrderId: 'SHOP-12345',
      requiredShipDate: '2026-08-25',
      recipientName: 'محمد أحمد',
      recipientPhone: '+963944123456',
      shippingPhoneCountry: 'SY',
      address: { governorate: 'حلب', city: 'أتارب' },
      lines: [{ sku: 'SKU-100', quantity: 2, unitPrice: 10 }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect((dto as unknown as { lines: Array<{ productId?: string }> }).lines[0].productId).toBeUndefined();
  });
});
