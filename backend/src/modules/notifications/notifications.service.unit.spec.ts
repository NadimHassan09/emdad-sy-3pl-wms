import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    role: 'super_admin' as const,
    companyId: null,
    tenantScope: 'all' as const,
    authorizedCompanyIds: [] as string[],
  };

  const rows = [
    {
      id: 'a1',
      type: 'admin_inbound_pending_approval',
      title: 'Inbound pending',
      body: 'Order waiting',
      referenceType: 'inbound_order',
      referenceId: 'o1',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-06-12T10:00:00Z'),
    },
    {
      id: 'a2',
      type: 'admin_sla_breach_l1',
      title: 'SLA breach',
      body: 'Task overdue',
      referenceType: 'warehouse_task',
      referenceId: 't1',
      isRead: true,
      readAt: new Date('2026-06-12T11:00:00Z'),
      createdAt: new Date('2026-06-11T10:00:00Z'),
    },
  ];

  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const realtime = {
    emitNotificationRead: jest.fn(),
    emitNotificationCreated: jest.fn(),
    emitNotificationDeleted: jest.fn(),
  };

  const service = new NotificationsService(prisma as never, realtime as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists notifications with pagination metadata', async () => {
    prisma.notification.findMany.mockResolvedValue([rows[0]]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await service.list(user, { limit: 20, offset: 0 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    expect(result.unreadCount).toBe(1);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('filters unread notifications when isRead=false', async () => {
    prisma.notification.findMany.mockResolvedValue([rows[0]]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await service.list(user, { limit: 10, offset: 0, isRead: false });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false, userId: user.id }),
      }),
    );
  });

  it('filters read notifications when isRead=true', async () => {
    prisma.notification.findMany.mockResolvedValue([rows[1]]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await service.list(user, { limit: 10, offset: 0, isRead: true });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: true }),
      }),
    );
  });
});
