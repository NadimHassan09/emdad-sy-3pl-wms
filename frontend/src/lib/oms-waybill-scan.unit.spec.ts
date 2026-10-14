import { describe, expect, it } from 'vitest';

import {
  normalizeWaybillScan,
  orderMatchesWaybillScan,
  waybillScanAttempts,
} from './oms-waybill-scan';

describe('waybill scan matching', () => {
  it('keeps an order number and strips a waybill URL to its last segment', () => {
    expect(normalizeWaybillScan(' OMS-2026-02933 ')).toBe('OMS-2026-02933');
    expect(normalizeWaybillScan('https://staging-admin.emdadsy.com/orders/oms/OMS-2026-02933')).toBe(
      'OMS-2026-02933',
    );
  });

  it('also tries the code without the EMD- prefix', () => {
    expect(waybillScanAttempts('EMD-OMS-2026-02933')).toEqual([
      'EMD-OMS-2026-02933',
      'OMS-2026-02933',
    ]);
  });

  it('matches the order number, tracking number, or printed waybill number', () => {
    const order = {
      orderNumber: 'OMS-2026-02933',
      trackingNumber: 'AWB-44',
      linkedOutboundOrder: { orderNumber: 'OUT-2026-01927', trackingNumber: null },
    };
    expect(orderMatchesWaybillScan(order, 'oms-2026-02933')).toBe(true);
    expect(orderMatchesWaybillScan(order, 'AWB-44')).toBe(true);
    expect(orderMatchesWaybillScan(order, 'EMD-OMS-2026-02933')).toBe(true);
    expect(orderMatchesWaybillScan(order, 'OUT-2026-01927')).toBe(true);
    expect(orderMatchesWaybillScan(order, 'OMS-2026-00001')).toBe(false);
  });
});
