import { describe, expect, it } from 'vitest';

import {
  filterQuotesByCompany,
  filterQuotesByDeliveryType,
  isLockedAssignmentState,
  isSendableAssignmentState,
  annotateQuotesForUi,
  type AssignmentState,
} from './shipping-compare';

describe('shipping-compare assignment + filters', () => {
  const quotes = [
    {
      carrierId: 'BABEL_EXPRESS',
      serviceId: 'babel-home',
      serviceName: 'Babel Home',
      carrierName: 'Babel Express',
      price: 100,
      currency: 'SYP',
      deliveryType: 'address',
      available: true,
    },
    {
      carrierId: 'BABEL_EXPRESS',
      serviceId: 'babel-hub',
      serviceName: 'Babel Hub',
      carrierName: 'Babel Express',
      price: 80,
      currency: 'SYP',
      deliveryType: 'hub',
      available: true,
    },
    {
      carrierId: 'SILA_SY',
      serviceId: 'SILA_SY:masarat',
      serviceName: 'Masarat',
      carrierName: 'Sila',
      price: 5,
      currency: 'USD',
      deliveryType: 'address',
      available: true,
    },
  ];

  it('Home filter drops hub options', () => {
    const filtered = filterQuotesByDeliveryType(quotes, 'address');
    expect(filtered.map((q) => q.serviceId)).toEqual(['babel-home', 'SILA_SY:masarat']);
  });

  it('company filter blocks unavailable by emptying quotes', () => {
    const filtered = filterQuotesByCompany(quotes, 'Tarabut');
    expect(filtered).toHaveLength(0);
  });

  it('company filter keeps matching courier family', () => {
    const filtered = filterQuotesByCompany(quotes, 'Masarat');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].serviceName).toBe('Masarat');
  });

  it('never treats Manual as a sendable auto state', () => {
    const states: AssignmentState[] = ['UNASSIGNED', 'BLOCKED', 'RECOMMENDED', 'USER_MODIFIED', 'CONFIRMED'];
    expect(isSendableAssignmentState('UNASSIGNED')).toBe(false);
    expect(isSendableAssignmentState('BLOCKED')).toBe(false);
    expect(isSendableAssignmentState('RECOMMENDED')).toBe(true);
    expect(isLockedAssignmentState('CONFIRMED')).toBe(true);
    expect(states).toContain('BLOCKED');
  });

  it('recommends cheapest among carrier quotes only (FX-aware)', () => {
    const annotated = annotateQuotesForUi(quotes, {
      usdToSypRate: 14500,
      source: 'test',
      timestamp: new Date().toISOString(),
    });
    const recommended = annotated.filter((q) => q.isRecommended);
    expect(recommended).toHaveLength(1);
    // 80 SYP ≈ 0.0055 USD vs 5 USD vs 100 SYP — Babel Hub wins
    expect(recommended[0].serviceId).toBe('babel-hub');
  });
});
