import { Injectable } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
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
  constructor(private readonly orders: OmsOrdersService) {}

  async approveBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const approvedOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.approve(id, user, {});
        approvedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Approve failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      approved: approvedOrders.length,
      failed: failures.length,
      approvedOrders,
      failures,
    };
  }

  async confirmBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkConfirmResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const confirmedOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.confirm(id, user);
        confirmedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Confirm failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      confirmed: confirmedOrders.length,
      failed: failures.length,
      confirmedOrders,
      failures,
    };
  }

  async cancelBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkCancelResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const cancelledOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.cancel(id, user);
        cancelledOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Cancel failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      cancelled: cancelledOrders.length,
      failed: failures.length,
      cancelledOrders,
      failures,
    };
  }

  async deliveredBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkStatusTransitionResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const completedOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.markDelivered(id, user);
        completedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Mark delivered failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      completed: completedOrders.length,
      failed: failures.length,
      completedOrders,
      failures,
    };
  }

  async failedDeliveryBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkStatusTransitionResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const completedOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.markFailedDelivery(id, user);
        completedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Mark failed delivery failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      completed: completedOrders.length,
      failed: failures.length,
      completedOrders,
      failures,
    };
  }

  async returnedBulk(user: AuthPrincipal, ids: string[]): Promise<OmsBulkStatusTransitionResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const completedOrders: OmsBulkResultItem[] = [];
    const failures: OmsBulkFailureItem[] = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.orders.markReturned(id, user);
        completedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          outboundOrderId: order.outboundOrderId ?? null,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          id,
          orderNumber: await this.lookupOrderNumber(user, id),
          error: err instanceof Error ? err.message : 'Mark returned failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      completed: completedOrders.length,
      failed: failures.length,
      completedOrders,
      failures,
    };
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
