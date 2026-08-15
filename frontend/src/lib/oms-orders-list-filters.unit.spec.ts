import { describe, expect, it } from 'vitest';

import {
  buildOmsOrdersListParams,
  countAppliedOmsAdvancedFilters,
  OMS_ORDERS_FILTER_DEFAULTS,
  type OmsOrdersListFilters,
} from './oms-orders-list-filters';

describe('buildOmsOrdersListParams', () => {
  it('omits empty fields and only sends total when value is set', () => {
    const applied: OmsOrdersListFilters = {
      ...OMS_ORDERS_FILTER_DEFAULTS,
      orderSearch: '  OMS  ',
      customer: 'Ahmed',
      totalOp: 'gte',
      totalValue: '',
      status: 'processing',
    };
    expect(buildOmsOrdersListParams(applied)).toEqual({
      orderSearch: 'OMS',
      orderId: undefined,
      companyId: undefined,
      customer: 'Ahmed',
      phone: undefined,
      city: undefined,
      totalOp: undefined,
      totalValue: undefined,
      status: 'processing',
    });
  });

  it('includes totalOp + totalValue together', () => {
    expect(
      buildOmsOrdersListParams({
        ...OMS_ORDERS_FILTER_DEFAULTS,
        totalOp: 'lt',
        totalValue: '25.5',
      }),
    ).toEqual(
      expect.objectContaining({
        totalOp: 'lt',
        totalValue: '25.5',
      }),
    );
  });
});

describe('countAppliedOmsAdvancedFilters', () => {
  it('counts advanced fields and status, not quick search alone', () => {
    expect(
      countAppliedOmsAdvancedFilters({
        ...OMS_ORDERS_FILTER_DEFAULTS,
        orderSearch: 'x',
      }),
    ).toBe(0);

    expect(
      countAppliedOmsAdvancedFilters({
        ...OMS_ORDERS_FILTER_DEFAULTS,
        companyId: 'c1',
        city: 'Damascus',
        status: 'shipped',
        totalOp: 'eq',
        totalValue: '10',
      }),
    ).toBe(4);
  });
});
