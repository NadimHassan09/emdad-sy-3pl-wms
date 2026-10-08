import { Injectable } from '@nestjs/common';
import { OmsOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { runPool } from '../../common/utils/async-pool';
import { OmsOrdersService } from './oms-orders.service';

export type OmsBulkResultItem = {
  id: string;
  orderNumber: string;
  outboundOrderId: string | null;
  status: string;
};

export type OmsBulkFailureItem = {
  id: string;
  orderNumber: string | null;
  error: string;
};

export type OmsBulkResponse = {
  requested: number;
  approved: number;
  failed: number;
  approvedOrders: OmsBulkResultItem[];
  failures: OmsBulkFailureItem[];
};

export type OmsBulkConfirmResponse = {
  requested: number;
  confirmed: number;
  failed: number;
  confirmedOrders: OmsBulkResultItem[];
  failures: OmsBulkFailureItem[];
};

export type OmsBulkCancelResponse = {
  requested: number;
  cancelled: number;
  failed: number;
  cancelledOrders: OmsBulkResultItem[];
  failures: OmsBulkFailureItem[];
};

export type OmsBulkStatusTransitionResponse = {
  requested: number;
  completed: number;
  failed: number;
  completedOrders: OmsBulkResultItem[];
  failures: OmsBulkFailureItem[];
};

/**
 * Bulk approve, confirm, and cancel for the admin OMS Orders page.
 * Reuses single-order workflows (validation, outbound provisioning, events);
 * each order is independent — failures do not roll back successes.
 */
@Injectable()
export class OmsBulkService {
  /** Controlled concurrency for OMS status/approval transitions. */
  private static readonly BULK_CONCURRENCY = 20;

  constructor(
    private readonly orders: OmsOrdersService,
    private readonly prisma: PrismaService,
  ) {}

  async approveBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkResponse> {
    const uniqueIds = this.uniqueIds(ids);

    // One stock check for the whole batch (instead of N identical groupBy queries).
    let stockPrechecked = false;
    try {
      const rows = await this.prisma.omsOrder.findMany({
        where: {
          id: { in: uniqueIds },
          status: {
            in: [
              OmsOrderStatus.confirmed_waiting_for_admin_approval,
              OmsOrderStatus.pending_approval,
            ],
          },
        },
        select: {
          companyId: true,
          lines: {
            select: {
              productId: true,
              requestedQuantity: true,
              product: { select: { id: true, sku: true } },
            },
          },
        },
      });
      const byCompany = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byCompany.get(row.companyId) ?? [];
        list.push(row);
        byCompany.set(row.companyId, list);
      }
      for (const [companyId, companyRows] of byCompany) {
        const lines = companyRows.flatMap((r) =>
          r.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: Number(l.requestedQuantity),
          })),
        );
        const products = companyRows.flatMap((r) =>
          r.lines.map((l) => ({
            id: l.product?.id ?? l.productId,
            sku: l.product?.sku ?? l.productId,
          })),
        );
        if (lines.length) {
          await this.orders.assertSufficientStockForLines(companyId, lines, products);
        }
      }
      stockPrechecked = true;
    } catch {
      stockPrechecked = false;
    }

    const { successes, failures } = await runPool<string, OmsBulkResultItem, OmsBulkFailureItem>(
      uniqueIds,
      OmsBulkService.BULK_CONCURRENCY,
      async (id) => {
        try {
          const order = await this.orders.approve(id, user, {}, {
            quiet: true,
            skipStockCheck: stockPrechecked,
          });
          return {
            ok: true as const,
            value: {
              id: order.id,
              orderNumber: order.orderNumber,
              outboundOrderId: order.outboundOrderId ?? null,
              status: order.status,
            },
          };
        } catch (err) {
          return {
            ok: false as const,
            value: {
              id,
              orderNumber: await this.lookupOrderNumber(user, id),
              error: err instanceof Error ? err.message : 'Approve failed.',
            },
          };
        }
      },
    );

    return {
      requested: uniqueIds.length,
      approved: successes.length,
      failed: failures.length,
      approvedOrders: successes,
      failures,
    };
  }

  async confirmBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkConfirmResponse> {
    const uniqueIds = this.uniqueIds(ids);

    // Fast path: bulk status flip for the common waiting_for_confirmation case.
    const now = new Date();
    const eligible = await this.prisma.omsOrder.findMany({
      where: {
        id: { in: uniqueIds },
        status: OmsOrderStatus.waiting_for_confirmation,
        needsInformation: false,
      },
      select: { id: true, orderNumber: true, outboundOrderId: true, companyId: true },
    });
    const eligibleIds = eligible.map((e) => e.id);
    if (eligibleIds.length) {
      await this.prisma.$transaction(async (tx) => {
        await tx.omsOrder.updateMany({
          where: {
            id: { in: eligibleIds },
            status: OmsOrderStatus.waiting_for_confirmation,
          },
          data: {
            status: OmsOrderStatus.confirmed_waiting_for_admin_approval,
            confirmedAt: now,
          },
        });
        await tx.omsOrderEvent.createMany({
          data: eligible.map((e) => ({
            omsOrderId: e.id,
            companyId: e.companyId,
            eventType: 'oms.confirmed',
            createdBy: user.id,
            payload: {
              via: 'admin_confirm_bulk',
              omsStatus: OmsOrderStatus.confirmed_waiting_for_admin_approval,
            } as Prisma.InputJsonValue,
          })),
        });
      });
    }

    const confirmedOrders: OmsBulkResultItem[] = eligible.map((e) => ({
      id: e.id,
      orderNumber: e.orderNumber,
      outboundOrderId: e.outboundOrderId ?? null,
      status: OmsOrderStatus.confirmed_waiting_for_admin_approval,
    }));
    const done = new Set(eligibleIds);
    const remainder = uniqueIds.filter((id) => !done.has(id));

    // Remainder: already confirmed (idempotent) or odd states — use single-order path.
    const { successes, failures } = await runPool<string, OmsBulkResultItem, OmsBulkFailureItem>(
      remainder,
      OmsBulkService.BULK_CONCURRENCY,
      async (id) => {
        try {
          const order = await this.orders.confirm(id, user, { quiet: true });
          return {
            ok: true as const,
            value: {
              id: order.id,
              orderNumber: order.orderNumber,
              outboundOrderId: order.outboundOrderId ?? null,
              status: order.status,
            },
          };
        } catch (err) {
          return {
            ok: false as const,
            value: {
              id,
              orderNumber: await this.lookupOrderNumber(user, id),
              error: err instanceof Error ? err.message : 'Confirm failed.',
            },
          };
        }
      },
    );

    return {
      requested: uniqueIds.length,
      confirmed: confirmedOrders.length + successes.length,
      failed: failures.length,
      confirmedOrders: [...confirmedOrders, ...successes],
      failures,
    };
  }

  async cancelBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkCancelResponse> {
    const uniqueIds = this.uniqueIds(ids);
    const { successes, failures } = await runPool<string, OmsBulkResultItem, OmsBulkFailureItem>(
      uniqueIds,
      OmsBulkService.BULK_CONCURRENCY,
      async (id) => {
        try {
          const order = await this.orders.cancel(id, user);
          return {
            ok: true as const,
            value: {
              id: order.id,
              orderNumber: order.orderNumber,
              outboundOrderId: order.outboundOrderId ?? null,
              status: order.status,
            },
          };
        } catch (err) {
          return {
            ok: false as const,
            value: {
              id,
              orderNumber: await this.lookupOrderNumber(user, id),
              error: err instanceof Error ? err.message : 'Cancel failed.',
            },
          };
        }
      },
    );

    return {
      requested: uniqueIds.length,
      cancelled: successes.length,
      failed: failures.length,
      cancelledOrders: successes,
      failures,
    };
  }

  async deliveredBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkStatusTransitionResponse> {
    return this.runStatusBulk(user, ids, (id) => this.orders.markDelivered(id, user), 'Mark delivered failed.');
  }

  async failedDeliveryBulk(
    user: AuthPrincipal,
    ids: string[],
  ): Promise<OmsBulkStatusTransitionResponse> {
    return this.runStatusBulk(
      user,
      ids,
      (id) => this.orders.markFailedDelivery(id, user),
      'Mark failed delivery failed.',
    );
  }

  async returnedBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkStatusTransitionResponse> {
    return this.runStatusBulk(user, ids, (id) => this.orders.markReturned(id, user), 'Mark returned failed.');
  }

  private async runStatusBulk(
    user: AuthPrincipal,
    ids: string[],
    action: (id: string) => Promise<{
      id: string;
      orderNumber: string;
      outboundOrderId?: string | null;
      status: string;
    }>,
    fallbackError: string,
  ): Promise<OmsBulkStatusTransitionResponse> {
    const uniqueIds = this.uniqueIds(ids);
    const { successes, failures } = await runPool<
      string,
      OmsBulkResultItem,
      OmsBulkFailureItem
    >(uniqueIds, OmsBulkService.BULK_CONCURRENCY, async (id) => {
      try {
        const order = await action(id);
        return {
          ok: true as const,
          value: {
            id: order.id,
            orderNumber: order.orderNumber,
            outboundOrderId: order.outboundOrderId ?? null,
            status: order.status,
          },
        };
      } catch (err) {
        return {
          ok: false as const,
          value: {
            id,
            orderNumber: await this.lookupOrderNumber(user, id),
            error: err instanceof Error ? err.message : fallbackError,
          },
        };
      }
    });

    return {
      requested: uniqueIds.length,
      completed: successes.length,
      failed: failures.length,
      completedOrders: successes,
      failures,
    };
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  }

  private async lookupOrderNumber(user: AuthPrincipal, id: string): Promise<string | null> {
    try {
      const order = await this.orders.findById(id, user);
      return order.orderNumber ?? null;
    } catch {
      return null;
    }
  }
}
