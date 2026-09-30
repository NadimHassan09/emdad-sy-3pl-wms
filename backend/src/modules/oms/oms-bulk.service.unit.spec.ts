import { OmsBulkService } from './oms-bulk.service';
import { OmsOrdersService } from './oms-orders.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';

describe('OmsBulkService', () => {
  let bulkService: OmsBulkService;
  let mockOrdersService: Partial<OmsOrdersService>;

  const mockUser: AuthPrincipal = {
    id: 'user-1',
    email: 'admin@test.com',
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  beforeEach(() => {
    mockOrdersService = {
      confirm: jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'processing',
        } as any),
      ),
      cancel: jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'cancelled',
        } as any),
      ),
      findById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
        } as any),
      ),
    };
    bulkService = new OmsBulkService(mockOrdersService as OmsOrdersService);
  });

  describe('confirmBulk', () => {
    it('confirms unique orders and tracks successes and failures', async () => {
      (mockOrdersService.confirm as jest.Mock).mockImplementation((id: string) => {
        if (id === 'fail-id') {
          return Promise.reject(new Error('Stock insufficient'));
        }
        return Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'processing',
        });
      });

      const res = await bulkService.confirmBulk(mockUser, ['ord-1', 'fail-id', 'ord-1']);
      expect(res.requested).toBe(2);
      expect(res.confirmed).toBe(1);
      expect(res.failed).toBe(1);
      expect(res.confirmedOrders).toEqual([
        {
          id: 'ord-1',
          orderNumber: 'ORD-ord-1',
          outboundOrderId: null,
          status: 'processing',
        },
      ]);
      expect(res.failures).toEqual([
        {
          id: 'fail-id',
          orderNumber: 'ORD-fail-id',
          error: 'Stock insufficient',
        },
      ]);
    });
  });

  describe('cancelBulk', () => {
    it('cancels unique orders and handles partial failure', async () => {
      (mockOrdersService.cancel as jest.Mock).mockImplementation((id: string) => {
        if (id === 'fail-id') {
          return Promise.reject(new Error('Cannot cancel shipped order'));
        }
        return Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'cancelled',
        });
      });

      const res = await bulkService.cancelBulk(mockUser, ['ord-1', 'fail-id']);
      expect(res.requested).toBe(2);
      expect(res.cancelled).toBe(1);
      expect(res.failed).toBe(1);
      expect(res.cancelledOrders).toEqual([
        {
          id: 'ord-1',
          orderNumber: 'ORD-ord-1',
          outboundOrderId: null,
          status: 'cancelled',
        },
      ]);
      expect(res.failures).toEqual([
        {
          id: 'fail-id',
          orderNumber: 'ORD-fail-id',
          error: 'Cannot cancel shipped order',
        },
      ]);
    });
  });

  describe('deliveredBulk', () => {
    it('marks eligible orders delivered', async () => {
      mockOrdersService.markDelivered = jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'delivered',
        } as any),
      );

      const res = await bulkService.deliveredBulk(mockUser, ['ord-1']);
      expect(res.requested).toBe(1);
      expect(res.completed).toBe(1);
      expect(res.completedOrders[0].status).toBe('delivered');
    });
  });

  describe('failedDeliveryBulk', () => {
    it('marks eligible orders failed delivery', async () => {
      mockOrdersService.markFailedDelivery = jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'failed_delivery',
        } as any),
      );

      const res = await bulkService.failedDeliveryBulk(mockUser, ['ord-1']);
      expect(res.requested).toBe(1);
      expect(res.completed).toBe(1);
      expect(res.completedOrders[0].status).toBe('failed_delivery');
    });
  });

  describe('returnedBulk', () => {
    it('marks eligible orders returned', async () => {
      mockOrdersService.markReturned = jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          orderNumber: `ORD-${id}`,
          outboundOrderId: null,
          status: 'returned',
        } as any),
      );

      const res = await bulkService.returnedBulk(mockUser, ['ord-1']);
      expect(res.requested).toBe(1);
      expect(res.completed).toBe(1);
      expect(res.completedOrders[0].status).toBe('returned');
    });
  });
});
