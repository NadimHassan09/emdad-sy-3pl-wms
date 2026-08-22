import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOmsOrderDto } from './oms-order.dto';

describe('CreateOmsOrderDto recipient contact bypass', () => {
  async function validateDto(partial: Record<string, unknown>) {
    const dto = plainToInstance(CreateOmsOrderDto, {
      requiredShipDate: '2026-08-20',
      lines: [{ productId: '00000000-0000-4000-8000-000000000001', requestedQuantity: 1 }],
      ...partial,
    });
    return validate(dto);
  }

  it('rejects invalid name and phone sent directly to the API', async () => {
    const errors = await validateDto({
      recipientName: 'Ahmed123@#$',
      recipientPhone: 'abc123',
      shippingPhoneCountry: 'EG',
    });
    expect(errors.some((e) => e.property === 'recipientName')).toBe(true);
    expect(errors.some((e) => e.property === 'recipientPhone')).toBe(true);
  });

  it('accepts a valid Arabic name and Egyptian E.164 phone', async () => {
    const errors = await validateDto({
      recipientName: 'محمد أحمد',
      recipientPhone: '+201001234567',
      shippingPhoneCountry: 'EG',
    });
    expect(errors.filter((e) => e.property === 'recipientName' || e.property === 'recipientPhone')).toHaveLength(
      0,
    );
  });
});
