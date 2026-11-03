import { carrierConstraintViolation } from './carrier-constraints';

describe('carrierConstraintViolation', () => {
  it('blocks Karam above 10 kg', () => {
    expect(carrierConstraintViolation({ serviceName: 'Karam', weightKg: 12 })).toMatch(/10 kg/);
  });

  it('allows Karam at exactly 10 kg', () => {
    expect(carrierConstraintViolation({ serviceName: 'Karam', weightKg: 10 })).toBeNull();
  });

  it('checks the heaviest carton too', () => {
    expect(
      carrierConstraintViolation({ serviceName: 'Karam', weightKg: 8, maxPartWeightKg: 11 }),
    ).not.toBeNull();
  });

  it('blocks Mersal only for explicit SYP COD', () => {
    const base = { serviceName: 'Mersal', codAmount: 100000, codCurrency: 'SYP' };
    expect(carrierConstraintViolation({ ...base, collectionMode: 'explicit' })).toMatch(/USD only/);
    expect(carrierConstraintViolation({ ...base, collectionMode: 'all' })).toBeNull();
    expect(
      carrierConstraintViolation({ ...base, collectionMode: 'explicit', codCurrency: 'USD' }),
    ).toBeNull();
    expect(
      carrierConstraintViolation({ ...base, collectionMode: 'explicit', codAmount: 0 }),
    ).toBeNull();
  });

  it('ignores couriers without documented limits', () => {
    expect(carrierConstraintViolation({ serviceName: 'TARABUT', weightKg: 500 })).toBeNull();
  });
});
