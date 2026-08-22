import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOmsOrderLineDto } from './oms-order.dto';

describe('CreateOmsOrderLineDto numeric rules', () => {
  async function validateLine(partial: Record<string, unknown>) {
    const dto = plainToInstance(CreateOmsOrderLineDto, {
      productId: '00000000-0000-4000-8000-000000000001',
      ...partial,
    });
    return validate(dto);
  }

  it('accepts whole-number qty and price', async () => {
    const errors = await validateLine({ requestedQuantity: 2, unitPrice: 0 });
    expect(errors).toHaveLength(0);
  });

  it('rejects decimal quantity', async () => {
    const errors = await validateLine({ requestedQuantity: 404.6555, unitPrice: 10 });
    expect(errors.some((e) => e.property === 'requestedQuantity')).toBe(true);
  });

  it('rejects zero and negative quantity', async () => {
    expect(
      (await validateLine({ requestedQuantity: 0, unitPrice: 1 })).some(
        (e) => e.property === 'requestedQuantity',
      ),
    ).toBe(true);
    expect(
      (await validateLine({ requestedQuantity: -1, unitPrice: 1 })).some(
        (e) => e.property === 'requestedQuantity',
      ),
    ).toBe(true);
  });

  it('rejects decimal and negative price', async () => {
    expect(
      (await validateLine({ requestedQuantity: 1, unitPrice: 10.5 })).some(
        (e) => e.property === 'unitPrice',
      ),
    ).toBe(true);
    expect(
      (await validateLine({ requestedQuantity: 1, unitPrice: -5 })).some(
        (e) => e.property === 'unitPrice',
      ),
    ).toBe(true);
  });
});
