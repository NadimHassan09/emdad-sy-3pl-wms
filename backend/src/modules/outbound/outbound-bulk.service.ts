import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CarrierShipmentStatus,
  OutboundOrderStatus,
  ShippingMethod,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import {
  calculateOrderVolume,
  calculateOrderWeight,
} from '../shipping/shipping-config.util';
import {
  BulkProcessOutboundItemDto,
  BulkShippingDetailsItemDto,
} from './dto/bulk-outbound.dto';
import { OutboundService } from './outbound.service';

type BulkItemResult = {
  outboundOrderId: string;
  orderNumber: string;
  status: string;
  awb?: string | null;
  note?: string;
};

type BulkItemFailure = {
  outboundOrderId: string;
  orderNumber: string | null;
  error: string;
};

type BulkIdsResponse = {
  requested: number;
  completed: number;
  failed: number;
  completedOrders: BulkItemResult[];
  failures: BulkItemFailure[];
};

const SHIPPING_DETAILS_ELIGIBLE: readonly string[] = [
  OutboundOrderStatus.waiting_for_shipping_method,
  OutboundOrderStatus.waiting_for_shipping_details,
];

/**
 * Bulk stage actions for the admin OMS Orders page.
 * Every item reuses the single-order admin services (plan validation, stage gates,
 * task completion, carrier send) and is processed independently — a failure on one
 * order never rolls back or blocks the others. Stage/status validation is the
 * existing one, so duplicate submissions fail per-order with clear messages
 * instead of double-executing.
 */
@Injectable()
export class OutboundBulkService {
  constructor(private readonly outbound: OutboundService) {}

  /**
   * Apply the admin-reviewed execution configuration to each selected order and
   * start execution: admin mode → updatePlan + approveAdmin (→ picking);
   * workers mode → updatePlan + confirm (→ picking with worker tasks).
   * Plan lines are always the order's own lines; the configuration applied is
   * exactly what the admin confirmed in the bulk execution plan modal.
   */
  async processBulk(
    user: AuthPrincipal,
    items: BulkProcessOutboundItemDto[],
  ): Promise<BulkIdsResponse> {
    this.assertNoDuplicateItems(items);
    const processedOrders: BulkItemResult[] = [];
    const failures: BulkItemFailure[] = [];

    for (const item of items) {
      const orderNumber = await this.lookupOrderNumber(user, item.outboundOrderId);
      try {
        const order = await this.outbound.findById(item.outboundOrderId, user);
        const plan = {
          warehouseId: item.warehouseId.trim(),
          ...(item.requiresPacking && item.packingLocationId?.trim()
            ? { packingLocationId: item.packingLocationId.trim() }
            : {}),
          dispatchDockId: item.dispatchDockId.trim(),
          requiresPacking: item.requiresPacking,
          lines: order.lines.map((l) => ({
            productId: l.productId,
            expectedQty: Number(l.requestedQuantity),
          })),
        };

        await this.outbound.updatePlan(user, order.id, {
          executionMode: item.executionMode,
          executionPlan: plan as unknown as Record<string, unknown>,
          requiresPacking: item.requiresPacking,
        });

        if (item.executionMode === 'admin') {
          await this.outbound.approveAdmin(user, order.id);
        } else {
          await this.outbound.confirmAndDeduct(user, order.id, {
            warehouseId: plan.warehouseId,
          });
        }

        const fresh = await this.outbound.findById(order.id, user);
        processedOrders.push({
          outboundOrderId: order.id,
          orderNumber: order.orderNumber,
          status: fresh.status,
        });
      } catch (err) {
        failures.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber,
          error: err instanceof Error ? err.message : 'Processing failed.',
        });
      }
    }

    return {
      requested: items.length,
      completed: processedOrders.length,
      failed: failures.length,
      completedOrders: processedOrders,
      failures,
    };
  }

  /** Bulk "Mark Picking as Complete" — existing picking stage validation applies per order. */
  async completePickingBulk(user: AuthPrincipal, ids: string[]): Promise<BulkIdsResponse> {
    return this.runIdsAction(user, ids, (orderId) =>
      this.outbound.completePickingAdmin(user, orderId),
    );
  }

  /** Bulk "Mark Packing as Complete" — requires packing stage + requiresPacking per order. */
  async completePackingBulk(user: AuthPrincipal, ids: string[]): Promise<BulkIdsResponse> {
    return this.runIdsAction(user, ids, (orderId) =>
      this.outbound.completePackingAdmin(user, orderId),
    );
  }

  /** Bulk "Mark Dispatch as Complete" — transitions ready_to_ship to shipped / out_for_delivery. */
  async completeDispatchBulk(user: AuthPrincipal, ids: string[]): Promise<BulkIdsResponse> {
    return this.runIdsAction(user, ids, (orderId) =>
      this.outbound.completeDispatchAdmin(user, orderId),
    );
  }

  /**
   * Prefill per-order shipping details (defaults computed from the order itself)
   * with a readiness check so the admin can quick-confirm ready orders and fix
   * only the ones needing attention.
   */
  async shippingDetailsPreview(user: AuthPrincipal, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const orders: Array<Record<string, unknown>> = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.outbound.findById(id, user);
        orders.push(this.previewOrder(order));
      } catch (err) {
        orders.push({
          outboundOrderId: id,
          orderNumber: null,
          status: null,
          ready: false,
          issues: [err instanceof Error ? err.message : 'Order not found.'],
        });
      }
    }

    return { orders };
  }

  /**
   * Bulk "Complete Shipping Details": per order — select method (when still at
   * waiting_for_shipping_method), save details, send carrier shipment (carrier
   * only, existing idempotent create path), then mark the stage complete →
   * ready_to_ship. Addresses are per-order; nothing is shared silently.
   */
  async shippingDetailsBulk(
    user: AuthPrincipal,
    items: BulkShippingDetailsItemDto[],
  ): Promise<BulkIdsResponse> {
    this.assertNoDuplicateItems(items);
    const processedOrders: BulkItemResult[] = [];
    const failures: BulkItemFailure[] = [];

    for (const item of items) {
      const orderNumber = await this.lookupOrderNumber(user, item.outboundOrderId);
      try {
        const result = await this.processShippingDetailsItem(user, item);
        processedOrders.push(result);
      } catch (err) {
        failures.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber,
          error: err instanceof Error ? err.message : 'Shipping details failed.',
        });
      }
    }

    return {
      requested: items.length,
      completed: processedOrders.length,
      failed: failures.length,
      completedOrders: processedOrders,
      failures,
    };
  }

  // ─── Per-item helpers ─────────────────────────────────────────────────────

  private async processShippingDetailsItem(
    user: AuthPrincipal,
    item: BulkShippingDetailsItemDto,
  ): Promise<BulkItemResult> {
    const method = item.shippingMethod;
    if (method === ShippingMethod.carrier && !item.shippingProviderCode?.trim()) {
      throw new BadRequestException(
        'shippingProviderCode is required when shipping via a shipping company.',
      );
    }

    const order = await this.outbound.findById(item.outboundOrderId, user);

    if (order.status === OutboundOrderStatus.ready_to_ship) {
      // Idempotent: already through shipping details — report without re-executing.
      const created = (order.carrierShipments ?? []).find(
        (s) => s.status === CarrierShipmentStatus.created,
      );
      return {
        outboundOrderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        awb: created?.externalAwb ?? null,
        note: 'Already waiting for dispatch — skipped.',
      };
    }

    if (
      order.status !== OutboundOrderStatus.waiting_for_shipping_method &&
      order.status !== OutboundOrderStatus.waiting_for_shipping_details
    ) {
      throw new BadRequestException(
        `Complete Shipping Details requires status waiting_for_shipping_method or waiting_for_shipping_details (current: ${order.status}).`,
      );
    }

    if (order.status === OutboundOrderStatus.waiting_for_shipping_method) {
      await this.outbound.selectShippingMethodAdmin(user, order.id, {
        ...item,
        shippingMethod: method,
      });
    } else {
      await this.outbound.saveShippingDetails(user, order.id, item);
    }

    let awb: string | null = null;
    if (method === ShippingMethod.carrier) {
      const mid = await this.outbound.findById(order.id, user);
      const created = (mid.carrierShipments ?? []).find(
        (s) => s.status === CarrierShipmentStatus.created,
      );
      if (!created) {
        // Existing carrier send path: resolves location, validates readiness,
        // creates the shipment idempotently, stores the AWB.
        await this.outbound.sendShippingDetails(user, order.id);
      }
      const after = await this.outbound.findById(order.id, user);
      const shipped = (after.carrierShipments ?? []).find(
        (s) => s.status === CarrierShipmentStatus.created,
      );
      if (!shipped) {
        throw new BadRequestException(
          'Carrier shipment was not created. Check the provider connection and shipping details.',
        );
      }
      awb = shipped.externalAwb ?? null;
    }

    await this.outbound.completeShippingDetailsAdmin(user, order.id);
    const fresh = await this.outbound.findById(order.id, user);

    return {
      outboundOrderId: order.id,
      orderNumber: order.orderNumber,
      status: fresh.status,
      awb,
    };
  }

  private async runIdsAction(
    user: AuthPrincipal,
    ids: string[],
    action: (orderId: string) => Promise<{ id: string; orderNumber: string; status: string }>,
  ): Promise<BulkIdsResponse> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const completedOrders: BulkItemResult[] = [];
    const failures: BulkItemFailure[] = [];

    for (const id of uniqueIds) {
      const orderNumber = await this.lookupOrderNumber(user, id);
      try {
        const order = await action(id);
        completedOrders.push({
          outboundOrderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
        });
      } catch (err) {
        failures.push({
          outboundOrderId: id,
          orderNumber,
          error: err instanceof Error ? err.message : 'Action failed.',
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

  private assertNoDuplicateItems(items: Array<{ outboundOrderId: string }>) {
    const seen = new Set<string>();
    for (const item of items) {
      const key = item.outboundOrderId.trim();
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate outbound orders in bulk request: ${key}`,
        );
      }
      seen.add(key);
    }
  }

  private async lookupOrderNumber(
    user: AuthPrincipal,
    outboundOrderId: string,
  ): Promise<string | null> {
    try {
      const order = await this.outbound.findById(outboundOrderId, user);
      return order.orderNumber;
    } catch {
      return null;
    }
  }

  private previewOrder(order: Awaited<ReturnType<OutboundService['findById']>>) {
    const lineQty = order.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity.toString(),
    }));
    const weightByProductId = new Map(
      order.lines.map((l) => [l.productId, l.product?.weightKg?.toString() ?? null]),
    );
    const volumeByProductId = new Map(
      order.lines.map((l) => [
        l.productId,
        (l.product as { volumeCbm?: { toString(): string } | null } | null)?.volumeCbm?.toString() ??
          null,
      ]),
    );

    const weightKg =
      order.shippingWeightKg != null
        ? Number(order.shippingWeightKg)
        : calculateOrderWeight(lineQty, weightByProductId);
    const volumeCbm =
      (order as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm != null
        ? Number((order as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm)
        : calculateOrderVolume(lineQty, volumeByProductId);

    const method = order.shippingMethod ?? ShippingMethod.manual;
    const packagesCount = Array.isArray(order.shippingPackages)
      ? (order.shippingPackages as unknown[]).length
      : 1;

    const issues: string[] = [];
    if (!SHIPPING_DETAILS_ELIGIBLE.includes(order.status)) {
      issues.push(
        `Status is ${order.status}; Complete Shipping Details needs waiting_for_shipping_method or waiting_for_shipping_details.`,
      );
    }
    if (!order.recipientPhone?.trim()) issues.push('Recipient phone is missing.');
    if (!order.city?.trim()) issues.push('Governorate (city) is missing.');
    if (!order.addressLine1?.trim()) issues.push('Town/neighborhood address is missing.');
    if (method === ShippingMethod.carrier) {
      if (!order.shippingProviderCode?.trim()) {
        issues.push('Shipping company (provider) is not selected.');
      }
      if (!order.shippingContents?.trim()) {
        issues.push('Shipment contents are required for carrier shipping.');
      }
      if (!order.shippingDeliveryType) {
        issues.push('Delivery type is required for carrier shipping.');
      }
      if (!order.shippingPickupType) {
        issues.push('Pickup type is required for carrier shipping.');
      }
      if (!order.shippingPayer) {
        issues.push('Shipping payer is required for carrier shipping.');
      }
      if (weightKg == null || !(weightKg > 0)) {
        issues.push('Shipping weight could not be calculated from the order lines.');
      }
    }

    return {
      outboundOrderId: order.id,
      orderNumber: order.orderNumber,
      omsOrderNumber: order.omsOrder?.orderNumber ?? null,
      status: order.status,
      executionMode: order.executionMode ?? null,
      companyId: order.companyId,
      companyName: order.company?.name ?? null,
      ready: issues.length === 0,
      issues,
      prefill: {
        recipientName: order.recipientName ?? null,
        recipientPhone: order.recipientPhone ?? null,
        city: order.city ?? null,
        district: order.district ?? null,
        addressLine1: order.addressLine1 ?? null,
        addressLine2: order.addressLine2 ?? null,
        shippingMethod: method,
        shippingProviderCode: order.shippingProviderCode ?? null,
        shippingPackageType: order.shippingPackageType ?? null,
        shippingContents: order.shippingContents ?? null,
        shippingDeliveryType: order.shippingDeliveryType ?? null,
        shippingPickupType: order.shippingPickupType ?? null,
        shippingPayer: order.shippingPayer ?? null,
        shippingWeightKg: Number.isFinite(weightKg) ? weightKg : null,
        shippingVolumeCbm: Number.isFinite(volumeCbm) ? volumeCbm : null,
        shippingPackagesCount: packagesCount,
        currency: order.currency ?? 'USD',
        babelNeighbourhoodId:
          order.babelNeighbourhoodId ?? order.omsOrder?.babelNeighbourhoodId ?? null,
        shippingReceiverLat:
          order.shippingReceiverLat != null ? Number(order.shippingReceiverLat) : null,
        shippingReceiverLng:
          order.shippingReceiverLng != null ? Number(order.shippingReceiverLng) : null,
      },
    };
  }
}
