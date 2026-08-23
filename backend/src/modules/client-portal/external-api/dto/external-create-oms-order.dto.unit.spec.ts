import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ExternalCreateOmsOrderDto } from './external-create-oms-order.dto';

const validPayload = {
  externalOrderId: 'SHOP-12345',
  requiredShipDate: '2026-08-25',
  recipientName: 'محمد أحمد',
  countryCode: '963',
  recipientPhone: '944123456',
  paymentMethod: 'COD',
  address: {
    governorate: 'حلب',
    city: 'أتارب',
    neighborhood: 'أرناز',
  },
  lines: [{ sku: 'SKU-100', quantity: 2, unitPrice: 10 }],
};

describe('ExternalCreateOmsOrderDto', () => {
  it('rejects missing address and SKU lines', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      externalOrderId: 'SHOP-1',
      requiredShipDate: '2026-08-25',
      recipientName: 'Ahmed',
      countryCode: '963',
      recipientPhone: '944123456',
      paymentMethod: 'COD',
      lines: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'address' || e.property === 'lines')).toBe(true);
  });

  it('accepts a valid OMS payload using SKU not productId', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(
      (dto as unknown as { lines: Array<{ productId?: string }> }).lines[0].productId,
    ).toBeUndefined();
  });

  it('requires recipient, countryCode, neighborhood, paymentMethod, and unitPrice', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      externalOrderId: 'SHOP-1',
      requiredShipDate: '2026-08-25',
      address: { governorate: 'حلب', city: 'أتارب' },
      lines: [{ sku: 'SKU-100', quantity: 1 }],
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining([
        'recipientName',
        'countryCode',
        'recipientPhone',
        'paymentMethod',
      ]),
    );
  });

  it('rejects externalOrderId with Arabic or symbols', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      ...validPayload,
      externalOrderId: 'SHOP-طلب-1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'externalOrderId')).toBe(true);
  });

  it('rejects phone with + or countryCode with +', async () => {
    const phoneDto = plainToInstance(ExternalCreateOmsOrderDto, {
      ...validPayload,
      recipientPhone: '+944123456',
    });
    const phoneErrors = await validate(phoneDto);
    expect(phoneErrors.some((e) => e.property === 'recipientPhone')).toBe(true);

    const ccDto = plainToInstance(ExternalCreateOmsOrderDto, {
      ...validPayload,
      countryCode: '+963',
    });
    const ccErrors = await validate(ccDto);
    expect(ccErrors.some((e) => e.property === 'countryCode')).toBe(true);
  });

  it('normalizes Prepaid payment method to PREPAID', async () => {
    const dto = plainToInstance(ExternalCreateOmsOrderDto, {
      ...validPayload,
      paymentMethod: 'Prepaid',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.paymentMethod).toBe('PREPAID');
  });
});
