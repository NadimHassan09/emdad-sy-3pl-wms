import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateClientOmsOrderDto } from './create-client-oms-order.dto';

describe('CreateClientOmsOrderDto addressLine2 validation (F-04)', () => {
  const baseValidPayload = {
    requiredShipDate: '2026-10-30',
    recipientName: 'Ahmad Mohamad',
    recipientPhone: '+963944123456',
    city: 'Damascus',
    district: 'Mezzeh',
    addressLine2: 'Al-Jalaa Street, Building 14, Floor 3',
    paymentMethod: 'COD',
    lines: [
      {
        productId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        requestedQuantity: 5,
      },
    ],
  };

  it('accepts valid addressLine2 with 11 or more characters', async () => {
    const dto = plainToInstance(CreateClientOmsOrderDto, baseValidPayload);
    const errors = await validate(dto);
    const addressLine2Errors = errors.filter((e) => e.property === 'addressLine2');
    expect(addressLine2Errors).toHaveLength(0);
  });

  it('rejects missing addressLine2', async () => {
    const { addressLine2: _, ...payloadWithoutAddressLine2 } = baseValidPayload;
    const dto = plainToInstance(CreateClientOmsOrderDto, payloadWithoutAddressLine2);
    const errors = await validate(dto);
    const addressLine2Error = errors.find((e) => e.property === 'addressLine2');
    expect(addressLine2Error).toBeDefined();
  });

  it('rejects whitespace-only addressLine2', async () => {
    const dto = plainToInstance(CreateClientOmsOrderDto, {
      ...baseValidPayload,
      addressLine2: '            ',
    });
    const errors = await validate(dto);
    const addressLine2Error = errors.find((e) => e.property === 'addressLine2');
    expect(addressLine2Error).toBeDefined();
    expect(addressLine2Error?.constraints?.isNotEmpty || addressLine2Error?.constraints?.minLength).toBeDefined();
  });

  it('rejects addressLine2 with 10 characters', async () => {
    const dto = plainToInstance(CreateClientOmsOrderDto, {
      ...baseValidPayload,
      addressLine2: '1234567890',
    });
    const errors = await validate(dto);
    const addressLine2Error = errors.find((e) => e.property === 'addressLine2');
    expect(addressLine2Error).toBeDefined();
    expect(addressLine2Error?.constraints?.minLength).toContain('more than 10 characters');
  });

  it('rejects addressLine2 with 11 characters when padded with spaces totaling <= 10 after trim', async () => {
    const dto = plainToInstance(CreateClientOmsOrderDto, {
      ...baseValidPayload,
      addressLine2: '   123456   ', // 6 chars when trimmed
    });
    const errors = await validate(dto);
    const addressLine2Error = errors.find((e) => e.property === 'addressLine2');
    expect(addressLine2Error).toBeDefined();
    expect(addressLine2Error?.constraints?.minLength).toBeDefined();
  });

  it('accepts addressLine2 that has 11 characters exactly when trimmed', async () => {
    const dto = plainToInstance(CreateClientOmsOrderDto, {
      ...baseValidPayload,
      addressLine2: ' 12345678901 ',
    });
    const errors = await validate(dto);
    const addressLine2Errors = errors.filter((e) => e.property === 'addressLine2');
    expect(addressLine2Errors).toHaveLength(0);
    expect(dto.addressLine2).toBe('12345678901');
  });
});
