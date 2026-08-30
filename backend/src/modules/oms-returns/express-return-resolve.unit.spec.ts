import { OmsOrderStatus } from '@prisma/client';

import {
  assertOmsOrderUuid,
  dedupeExpressReturnInputs,
  expressReturnStatusRejectReason,
  looksLikeUuid,
  resolveExpressReturnOrder,
} from './express-return-resolve';

describe('express-return-resolve', () => {
  describe('looksLikeUuid / assertOmsOrderUuid', () => {
    it('accepts full UUIDs only', () => {
      expect(looksLikeUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
      expect(looksLikeUuid('OMS-12345')).toBe(false);
      expect(looksLikeUuid('CL-7788')).toBe(false);
      expect(() => assertOmsOrderUuid('OMS-12345')).toThrow(/resolved UUID/);
      expect(() =>
        assertOmsOrderUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).not.toThrow();
    });
  });

  describe('dedupeExpressReturnInputs', () => {
    it('dedupes case-insensitively and keeps first occurrence', () => {
      expect(dedupeExpressReturnInputs(['OMS-1', 'oms-1', 'CL-2', ' OMS-1 '])).toEqual([
        'OMS-1',
        'CL-2',
      ]);
    });
  });

  describe('expressReturnStatusRejectReason', () => {
    it('maps cancelled and in-progress clearly', () => {
      expect(expressReturnStatusRejectReason(OmsOrderStatus.cancelled)).toBe(
        'Order is cancelled',
      );
      expect(expressReturnStatusRejectReason(OmsOrderStatus.processing)).toBe(
        'Order is still in progress',
      );
      expect(expressReturnStatusRejectReason(OmsOrderStatus.returned)).toBe(
        'Order is already fully returned',
      );
    });
  });

  describe('resolveExpressReturnOrder', () => {
    const order = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      orderNumber: 'OMS-12345',
      clientReference: 'CL-7788',
      status: OmsOrderStatus.delivered,
    };

    it('resolves by UUID', async () => {
      const prisma = {
        omsOrder: {
          findUnique: jest.fn().mockResolvedValue(order),
          findMany: jest.fn(),
        },
      };
      const result = await resolveExpressReturnOrder(prisma, order.id);
      expect(result).toEqual({ ok: true, order, matchedBy: 'id' });
      expect(prisma.omsOrder.findUnique).toHaveBeenCalled();
      expect(prisma.omsOrder.findMany).not.toHaveBeenCalled();
    });

    it('resolves by orderNumber then clientReference', async () => {
      const prisma = {
        omsOrder: {
          findUnique: jest.fn(),
          findMany: jest
            .fn()
            .mockResolvedValueOnce([order])
            .mockResolvedValueOnce([]),
        },
      };
      const byNumber = await resolveExpressReturnOrder(prisma, 'OMS-12345');
      expect(byNumber).toEqual({ ok: true, order, matchedBy: 'orderNumber' });

      const prisma2 = {
        omsOrder: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([order]),
        },
      };
      const byRef = await resolveExpressReturnOrder(prisma2, 'CL-7788');
      expect(byRef).toEqual({ ok: true, order, matchedBy: 'clientReference' });
    });

    it('rejects ambiguous client reference and not found', async () => {
      const prisma = {
        omsOrder: {
          findUnique: jest.fn(),
          findMany: jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([order, { ...order, id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }]),
        },
      };
      const ambiguous = await resolveExpressReturnOrder(prisma, 'CL-7788');
      expect(ambiguous.ok).toBe(false);
      if (!ambiguous.ok) {
        expect(ambiguous.error).toMatch(/Ambiguous client reference/i);
      }

      const prismaEmpty = {
        omsOrder: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const missing = await resolveExpressReturnOrder(prismaEmpty, 'OMS-99999');
      expect(missing).toEqual({ ok: false, error: 'Order not found.' });
    });
  });
});
