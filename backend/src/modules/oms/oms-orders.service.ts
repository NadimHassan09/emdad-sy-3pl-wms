import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  OmsOrderStatus,
  OutboundOrderStatus,
  Prisma,
  ShippingMethod,
} from '@prisma/client';

import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { assertDiscreteUomPositiveIntegerQuantity } from '../../common/utils/discrete-uom-quantity';
import { assertCalendarDateNotBeforeToday } from '../../common/utils/order-planning-date';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import { normalizeRecipientContact } from '../../common/validators/recipient-contact';
import { RealtimeService } from '../realtime/realtime.service';
import { adminOutboundListItem } from '../realtime/realtime-client.payload';
import { OutboundService } from '../outbound/outbound.service';
import { CodRecordsService } from '../cod/cod-records.service';
import {
  AllocateOmsOrderDto,
  ApproveOmsOrderDto,
  CreateOmsOrderDto,
  RejectOmsOrderDto,
  UpdateOmsOrderDto,
} from './dto/oms-order.dto';
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';
import { appendOmsOrderFieldFilters } from './oms-orders-list-filters.util';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OmsOutboundSyncService } from './oms-outbound-sync.service';
import {
  composeDestinationAddress,
  deriveCodStatus,
  mapOutboundStatusToOms,
  serializeOmsOrder,
  serializeOmsOrderListItem,
} from './oms-order.mapper';
import {
  assertOmsTransition,
  resolveOmsActorRole,
} from './oms-order-transitions';
import { OrderAllocationService } from './order-allocation.service';
import { ShippingGeoService } from '../shipping/shipping-geo.service';
import { ShippingService } from '../shipping/shipping.service';
import { resolveOmsDeliveryLocation } from './oms-delivery-resolution';
import {
  assertShippingIntentReady,
  assertShippingConfigUnlocked,
  hasShippingConfigPatch,
  resolveShippingWeightKg,
  resolveShippingVolumeCbm,
  shippingPrismaData,
} from '../shipping/shipping-config.util';

function assertAndNormalizeRecipientContact(dto: {
  recipientName?: string;
  recipientPhone?: string;
  shippingPhoneCountry?: string | null;
}) {
  const result = normalizeRecipientContact({
    recipientName: dto.recipientName,
    recipientPhone: dto.recipientPhone,
    shippingPhoneCountry: dto.shippingPhoneCountry,
  });
  if (!result.ok) {
    throw new BadRequestException(result.message);
  }
  return result.value;
}

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  outboundOrder: { select: { id: true, orderNumber: true, status: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          status: true,
          trackingType: true,
          uom: true,
          weightKg: true,
          volumeCbm: true,
        },
      },
    },
  },
} satisfies Prisma.OmsOrderInclude;

@Injectable()
export class OmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OutboundService))
    private readonly outbound: OutboundService,
    private readonly companyAccess: CompanyAccessService,
    private readonly allocation: OrderAllocationService,
    private readonly events: OmsOrderEventsService,
    private readonly sync: OmsOutboundSyncService,
    private readonly realtime: RealtimeService,
    @Inject(forwardRef(() => CodRecordsService))
    private readonly cod: CodRecordsService,
    @Inject(forwardRef(() => ShippingService))
    private readonly shipping: ShippingService,
    private readonly geo: ShippingGeoService,
  ) {}

  /** Shared list filter builder — export must use the exact same where clause. */
  buildListWhere(
    user: AuthPrincipal,
    query: ListOmsOrdersQueryDto,
  ): Prisma.OmsOrderWhereInput {
    const where: Prisma.OmsOrderWhereInput = {};
    const andParts: Prisma.OmsOrderWhereInput[] = [];

    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
    if (companyId) where.companyId = companyId;
    if (query.status) {
      // Expand commercial filter to include leftover legacy synonyms.
      const expansions: Partial<Record<OmsOrderStatus, OmsOrderStatus[]>> = {
        [OmsOrderStatus.waiting_for_confirmation]: [
          OmsOrderStatus.waiting_for_confirmation,
          OmsOrderStatus.draft,
        ],
        [OmsOrderStatus.confirmed_waiting_for_admin_approval]: [
          OmsOrderStatus.confirmed_waiting_for_admin_approval,
          OmsOrderStatus.pending_approval,
        ],
        [OmsOrderStatus.processing]: [
          OmsOrderStatus.processing,
          OmsOrderStatus.pending,
          OmsOrderStatus.approved,
          OmsOrderStatus.confirmed,
          OmsOrderStatus.allocated,
          OmsOrderStatus.picking,
          OmsOrderStatus.packing,
        ],
        [OmsOrderStatus.shipped]: [
          OmsOrderStatus.shipped,
          OmsOrderStatus.out_for_delivery,
        ],
        [OmsOrderStatus.delivered]: [
          OmsOrderStatus.delivered,
          OmsOrderStatus.completed,
        ],
        [OmsOrderStatus.cancelled]: [
          OmsOrderStatus.cancelled,
          OmsOrderStatus.rejected,
        ],
      };
      where.status = expansions[query.status]
        ? { in: expansions[query.status] }
        : query.status;
    }
    if (query.storeChannel?.trim()) {
      where.storeChannel = { contains: query.storeChannel.trim(), mode: 'insensitive' };
    }
    if (query.linkStatus === 'linked') where.outboundOrderId = { not: null };
    if (query.linkStatus === 'unlinked') where.outboundOrderId = null;

    appendOmsOrderFieldFilters(query, where, andParts);

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (andParts.length > 0) where.AND = andParts;
    return where;
  }

  async list(user: AuthPrincipal, query: ListOmsOrdersQueryDto) {
    const where = this.buildListWhere(user, query);

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.omsOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: ORDER_INCLUDE,
          take: query.limit,
          skip: query.offset,
        }),
        tx.omsOrder.count({ where }),
      ]);
      return {
        items: items.map(serializeOmsOrderListItem),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  /** Same filters as list(), capped for CSV export (no pagination window). */
  async listForExport(
    user: AuthPrincipal,
    query: ListOmsOrdersQueryDto,
    opts: { maxRows: number },
  ) {
    const where = this.buildListWhere(user, query);
    return withTenantRls(this.prisma, user, async (tx) => {
      const total = await tx.omsOrder.count({ where });
      const rows = await tx.omsOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: ORDER_INCLUDE,
        take: opts.maxRows,
      });
      return {
        items: rows.map(serializeOmsOrder),
        total,
        truncated: total > rows.length,
      };
    });
  }

  resolveImportCompanyId(user: AuthPrincipal, companyId?: string): string {
    return this.companyAccess.resolveWriteCompanyId(user, companyId);
  }

  async findExistingByExternalReference(
    user: AuthPrincipal,
    companyId: string,
    externalReference: string,
  ) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    return withTenantRls(this.prisma, user, async (tx) =>
      tx.omsOrder.findFirst({
        where: {
          companyId,
          externalReference: { equals: externalReference, mode: 'insensitive' },
        },
        select: { id: true, orderNumber: true },
      }),
    );
  }

  async findProductsBySkus(companyId: string, skus: string[]) {
    const upper = skus.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (upper.length === 0) return [];
    return this.prisma.product.findMany({
      where: {
        companyId,
        OR: upper.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })),
      },
      select: { id: true, sku: true, companyId: true, status: true, uom: true },
    });
  }

  /**
   * Reuse create-path business checks without writing (import validate phase).
   * Throws the same BadRequest/NotFound as create would.
   */
  async assertImportCreateReady(user: AuthPrincipal, dto: CreateOmsOrderDto): Promise<void> {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');
    assertAndNormalizeRecipientContact(dto);
    const destination = composeDestinationAddress(dto);
    if (!destination) {
      throw new BadRequestException(
        'Destination address is required (address line / city / destination).',
      );
    }
    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        companyId: true,
        status: true,
        uom: true,
        sku: true,
        weightKg: true,
        volumeCbm: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    const wrongCompany = products.find((p) => p.companyId !== companyId);
    if (wrongCompany) {
      throw new BadRequestException(
        'All line products must belong to the same company as the order.',
      );
    }
    for (const p of products) assertProductOrderableForOrders(p.status);
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const l of dto.lines) {
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.requestedQuantity, 'Requested quantity');
    }
    const shippingMethod = dto.shippingMethod ?? null;
    const shippingFields = {
      shippingMethod,
      shippingProviderCode: dto.shippingProviderCode,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      shippingPackageType: dto.shippingPackageType,
      shippingContents: dto.shippingContents,
      shippingDeliveryType: dto.shippingDeliveryType,
      shippingPickupType: dto.shippingPickupType,
      shippingPayer: dto.shippingPayer,
      shippingWeightKg: dto.shippingWeightKg,
      shippingVolumeCbm: dto.shippingVolumeCbm,
      shippingPhoneCountry: dto.shippingPhoneCountry,
    };
    assertShippingIntentReady(shippingFields);
    await this.assertSufficientStockForLines(companyId, dto.lines, products);
  }

  async create(
    user: AuthPrincipal,
    dto: CreateOmsOrderDto,
    opts?: {
      provisionOutbound?: boolean;
      bulkImport?: { batchId: string; externalReference?: string };
      needsInformation?: boolean;
    },
  ) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');
    const contact = assertAndNormalizeRecipientContact(dto);
    const bulkImport = opts?.bulkImport;
    const needsInformation = !!opts?.needsInformation;
    const provisionOutbound =
      !bulkImport && !!opts?.provisionOutbound && !dto.outboundOrderId;

    if (dto.outboundOrderId) {
      await this.assertOutboundLinkable(user, dto.outboundOrderId, companyId);
    }

    let destination = composeDestinationAddress(dto);
    if (!destination && dto.outboundOrderId) {
      const linked = await this.outbound.findById(dto.outboundOrderId, user);
      destination = linked.destinationAddress?.trim() || 'Linked outbound order';
    }
    if (!destination) {
      if (needsInformation) {
        destination = 'Shipping/Delivery information is incomplete.';
      } else {
        throw new BadRequestException(
          'Destination address is required (address line / city / destination).',
        );
      }
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, status: true, uom: true, sku: true, weightKg: true, volumeCbm: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    const wrongCompany = products.find((p) => p.companyId !== companyId);
    if (wrongCompany) {
      throw new BadRequestException(
        'All line products must belong to the same company as the order.',
      );
    }
    for (const p of products) assertProductOrderableForOrders(p.status);
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const l of dto.lines) {
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.requestedQuantity, 'Requested quantity');
    }

    const weightByProductId = new Map(
      products.map((p) => [p.id, p.weightKg?.toString() ?? null] as const),
    );
    const volumeByProductId = new Map(
      products.map((p) => [p.id, p.volumeCbm?.toString() ?? null] as const),
    );
    const shippingMethod = dto.shippingMethod ?? null;
    const lineQty = dto.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity,
    }));
    const shippingWeightKg = resolveShippingWeightKg({
      method: shippingMethod,
      explicit: dto.shippingWeightKg,
      lines: lineQty,
      weightByProductId,
    });
    const shippingVolumeCbm = resolveShippingVolumeCbm({
      method: shippingMethod,
      explicit: dto.shippingVolumeCbm,
      lines: lineQty,
      volumeByProductId,
    });
    const shippingFields = {
      shippingMethod,
      shippingProviderCode: dto.shippingProviderCode,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      shippingPackageType: dto.shippingPackageType,
      shippingContents: dto.shippingContents,
      shippingDeliveryType: dto.shippingDeliveryType,
      shippingPickupType: dto.shippingPickupType,
      shippingPayer: dto.shippingPayer,
      shippingWeightKg,
      shippingVolumeCbm,
      shippingPhoneCountry:
        contact.shippingPhoneCountry !== undefined
          ? contact.shippingPhoneCountry
          : dto.shippingPhoneCountry,
    };
    assertShippingIntentReady(shippingFields);
    await this.shipping.assertLiveCarrierSelection({
      fields: shippingFields,
      governorate: dto.city,
      city: dto.district,
      neighborhood: dto.addressLine1,
    });

    // Validate availability only — do not reserve until outbound is generated.
    await this.assertSufficientStockForLines(companyId, dto.lines, products);

    const linesWithTotals = dto.lines.map((l) => {
      const qty = new Prisma.Decimal(l.requestedQuantity);
      const unitPrice =
        l.unitPrice != null ? new Prisma.Decimal(l.unitPrice) : null;
      const lineTotal =
        l.lineTotal != null
          ? new Prisma.Decimal(l.lineTotal)
          : unitPrice != null
            ? unitPrice.mul(qty)
            : null;
      return { ...l, qty, unitPrice, lineTotal };
    });

    const linesSum = linesWithTotals.reduce(
      (sum, l) => (l.lineTotal != null ? sum.add(l.lineTotal) : sum),
      new Prisma.Decimal(0),
    );
    const shippingFee =
      dto.shippingFee != null ? new Prisma.Decimal(dto.shippingFee) : new Prisma.Decimal(0);
    const subtotal = linesSum.add(shippingFee);
    const derivedCod =
      dto.codAmount != null
        ? new Prisma.Decimal(dto.codAmount)
        : dto.paymentMethod === 'COD'
          ? subtotal
          : null;

    const codStatus = deriveCodStatus(dto.paymentMethod, derivedCod);
    const now = new Date();
    // Backend-enforced create rules (not a frontend shortcut):
    // - Admin provisionOutbound → processing + outbound (exactly once, idempotent sync)
    // - Client / no provision → waiting_for_confirmation (no outbound)
    // - Bulk CSV import → confirmed_waiting_for_admin_approval (no outbound; admin must approve)
    // - Explicit outbound link (legacy) → draft
    const initialStatus = dto.outboundOrderId
      ? OmsOrderStatus.draft
      : bulkImport
        ? OmsOrderStatus.confirmed_waiting_for_admin_approval
        : provisionOutbound
          ? OmsOrderStatus.processing
          : OmsOrderStatus.waiting_for_confirmation;

    if (bulkImport && dto.externalReference?.trim()) {
      const existing = await this.findExistingByExternalReference(
        user,
        companyId,
        dto.externalReference.trim(),
      );
      if (existing) {
        throw new BadRequestException(
          `Order with external_reference "${dto.externalReference.trim()}" already exists (${existing.orderNumber}).`,
        );
      }
    }

    const order = await withTenantRls(this.prisma, user, async (tx) => {
      const created = await tx.omsOrder.create({
        data: {
          companyId,
          outboundOrderId: dto.outboundOrderId,
          status: initialStatus,
          destinationAddress: destination,
          requiredShipDate: new Date(dto.requiredShipDate),
          carrier: dto.carrier,
          clientReference: dto.clientReference,
          notes: dto.notes,
          requiresPacking: dto.requiresPacking !== false,
          recipientName:
            contact.recipientName !== undefined ? contact.recipientName : dto.recipientName,
          recipientPhone:
            contact.recipientPhone !== undefined ? contact.recipientPhone : dto.recipientPhone,
          city: dto.city,
          district: dto.district,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          deliveryInstructions: dto.deliveryInstructions,
          paymentMethod: dto.paymentMethod,
          subtotal,
          shippingFee: dto.shippingFee != null ? shippingFee : undefined,
          codAmount: derivedCod ?? undefined,
          currency: dto.currency ?? 'USD',
          codStatus: codStatus ?? undefined,
          storeChannel: dto.storeChannel,
          externalReference: dto.externalReference,
          needsInformation,
          importBatchId: bulkImport?.batchId,
          ...shippingPrismaData(shippingFields),
          submittedAt:
            initialStatus === OmsOrderStatus.waiting_for_confirmation ||
            initialStatus === OmsOrderStatus.processing ||
            initialStatus === OmsOrderStatus.confirmed_waiting_for_admin_approval
              ? now
              : undefined,
          confirmedAt:
            provisionOutbound ||
            initialStatus === OmsOrderStatus.confirmed_waiting_for_admin_approval
              ? now
              : undefined,
          approvedAt: provisionOutbound ? now : undefined,
          approvedBy: provisionOutbound ? user.id : undefined,
          createdBy: user.id,
          lines: {
            create: linesWithTotals.map((l, idx) => ({
              productId: l.productId,
              requestedQuantity: l.qty,
              specificLotId: l.specificLotId,
              lineNumber: idx + 1,
              unitPrice: l.unitPrice ?? undefined,
              lineTotal: l.lineTotal ?? undefined,
              discountAmount:
                l.discountAmount != null ? new Prisma.Decimal(l.discountAmount) : undefined,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      await this.events.record(tx, {
        omsOrderId: created.id,
        outboundOrderId: created.outboundOrderId ?? undefined,
        companyId: created.companyId,
        eventType: 'oms.created',
        createdBy: user.id,
        payload: {
          linkedOutbound: !!created.outboundOrderId,
          status: created.status,
          provisionOutbound,
          bulkImport: !!bulkImport,
          importBatchId: bulkImport?.batchId,
          needsInformation,
        },
      });

      if (created.status === OmsOrderStatus.waiting_for_confirmation) {
        await this.events.record(tx, {
          omsOrderId: created.id,
          companyId: created.companyId,
          eventType: 'order.waiting_for_confirmation',
          createdBy: user.id,
        });
      }

      if (bulkImport) {
        await this.events.record(tx, {
          omsOrderId: created.id,
          companyId: created.companyId,
          eventType: 'oms.bulk_imported',
          createdBy: user.id,
          payload: {
            batchId: bulkImport.batchId,
            externalReference: bulkImport.externalReference ?? dto.externalReference ?? null,
            status: created.status,
            needsInformation,
          },
        });
      }

      if (provisionOutbound) {
        await this.sync.createOutboundFromOms(tx, {
          omsOrderId: created.id,
          actorUserId: user.id,
        });
        return tx.omsOrder.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
      }

      if (
        created.outboundOrderId &&
        this.allocation.isEnabled() &&
        dto.warehouseId
      ) {
        await this.allocateLinkedOutbound(tx, user, created.id, created.outboundOrderId, {
          warehouseId: dto.warehouseId,
        });
        return tx.omsOrder.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
      }

      return created;
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.outboundOrderId && provisionOutbound) {
      this.realtime.emitOutboundOrderCreated(order.companyId, {
        orderId: order.outboundOrderId,
        status: 'draft',
      });
    }
    this.emitOms('oms.created', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async confirm(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);
    const actor = resolveOmsActorRole(user.role);
    const action = actor === 'client' ? 'client_confirm' : 'admin_confirm';

    // Idempotent client confirm
    if (
      actor === 'client' &&
      existing.status === OmsOrderStatus.confirmed_waiting_for_admin_approval
    ) {
      return serializeOmsOrder(existing);
    }
    // Idempotent admin confirm / already processing with outbound
    if (
      actor === 'admin' &&
      existing.status === OmsOrderStatus.processing &&
      existing.outboundOrderId
    ) {
      return serializeOmsOrder(existing);
    }

    const next = assertOmsTransition(existing.status, action, actor);

    if (next === OmsOrderStatus.processing) {
      const products = existing.lines.map((l) => ({
        id: l.productId,
        sku: l.product?.sku ?? l.productId,
      }));
      await this.assertSufficientStockForLines(
        existing.companyId,
        existing.lines.map((l) => ({
          productId: l.productId,
          requestedQuantity: Number(l.requestedQuantity),
        })),
        products,
      );

      const order = await withTenantRls(this.prisma, user, async (tx) => {
        await this.sync.createOutboundFromOms(tx, {
          omsOrderId: existing.id,
          actorUserId: user.id,
        });
        await this.events.record(tx, {
          omsOrderId: existing.id,
          companyId: existing.companyId,
          eventType: 'oms.confirmed',
          createdBy: user.id,
          payload: { via: 'admin_confirm', omsStatus: OmsOrderStatus.processing },
        });
        return tx.omsOrder.findUnique({ where: { id: existing.id }, include: ORDER_INCLUDE });
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (order.outboundOrderId) {
        this.realtime.emitOutboundOrderCreated(order.companyId, {
          orderId: order.outboundOrderId,
          status: 'draft',
        });
      }
      this.emitOms('oms.confirmed', order.companyId, order.id, order.status);
      return serializeOmsOrder(order);
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id: existing.id },
        data: {
          status: next,
          confirmedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: row.id,
        companyId: row.companyId,
        eventType: 'oms.confirmed',
        createdBy: user.id,
        payload: { via: 'client_confirm', omsStatus: next },
      });
      return row;
    });
    this.emitOms('oms.confirmed', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async approve(id: string, user: AuthPrincipal, dto: ApproveOmsOrderDto = {}) {
    const existing = await this.resolveOrder(id, user);

    if (existing.needsInformation) {
      throw new InvalidStateException(
        'This order is incomplete. Shipping/Delivery information must be completed before approval.',
      );
    }

    // Idempotent: already processing with outbound linked.
    if (
      (existing.status === OmsOrderStatus.processing ||
        existing.status === OmsOrderStatus.pending) &&
      existing.outboundOrderId
    ) {
      return serializeOmsOrder(existing);
    }

    assertOmsTransition(existing.status, 'admin_approve', 'admin');

    const products = existing.lines.map((l) => ({
      id: l.productId,
      sku: l.product?.sku ?? l.productId,
    }));
    await this.assertSufficientStockForLines(
      existing.companyId,
      existing.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: Number(l.requestedQuantity),
      })),
      products,
    );

    const order = await withTenantRls(this.prisma, user, async (tx) => {
      if (dto.shippingFee != null) {
        const linesSum = existing.lines.reduce((sum, l) => {
          if (l.lineTotal != null) return sum.add(l.lineTotal);
          if (l.unitPrice != null) return sum.add(l.unitPrice.mul(l.requestedQuantity));
          return sum;
        }, new Prisma.Decimal(0));
        const ship = new Prisma.Decimal(dto.shippingFee);
        const subtotal = linesSum.add(ship);
        await tx.omsOrder.update({
          where: { id: existing.id },
          data: {
            shippingFee: ship,
            subtotal,
            codAmount:
              existing.paymentMethod === 'COD' ? subtotal : existing.codAmount ?? undefined,
          },
        });
      }

      await this.sync.createOutboundFromOms(tx, {
        omsOrderId: existing.id,
        actorUserId: user.id,
      });

      return tx.omsOrder.findUnique({ where: { id: existing.id }, include: ORDER_INCLUDE });
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.outboundOrderId) {
      this.realtime.emitOutboundOrderCreated(order.companyId, {
        orderId: order.outboundOrderId,
        status: 'draft',
      });
    }
    this.emitOms('oms.approved', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async reject(id: string, user: AuthPrincipal, dto: RejectOmsOrderDto = {}) {
    const existing = await this.resolveOrder(id, user);
    assertOmsTransition(existing.status, 'reject', 'admin');

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id: existing.id },
        data: {
          status: OmsOrderStatus.cancelled,
          rejectedAt: new Date(),
          rejectedBy: user.id,
          cancelledAt: new Date(),
          cancelledBy: user.id,
          rejectionReason: dto.reason?.trim() || null,
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: row.id,
        companyId: row.companyId,
        eventType: 'oms.cancelled',
        createdBy: user.id,
        payload: { reason: dto.reason?.trim() || null, via: 'reject' },
      });
      return row;
    });

    this.emitOms('oms.cancelled', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async markFailedDelivery(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);
    const next = assertOmsTransition(existing.status, 'failed_delivery', 'admin');
    return this.transition(id, user, {
      allowed: [existing.status],
      next,
      event: 'order.failed_delivery',
      extra: {},
    });
  }

  async markCompleted(_id: string, _user: AuthPrincipal) {
    throw new BadRequestException(
      'Delivered is the terminal success state. There is no separate Completed status.',
    );
  }

  /** Rejects when summed line qty per product exceeds aggregate available stock. */
  async assertSufficientStockForLines(
    companyId: string,
    lines: { productId: string; requestedQuantity: number }[],
    products: { id: string; sku: string }[],
  ): Promise<void> {
    const productIds = Array.from(new Set(lines.map((l) => l.productId)));
    const requestedByProduct = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      const cur = requestedByProduct.get(l.productId) ?? new Prisma.Decimal(0);
      requestedByProduct.set(
        l.productId,
        cur.plus(new Prisma.Decimal(l.requestedQuantity)),
      );
    }

    const availability = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
        companyId,
        productId: { in: productIds },
        status: 'available',
      },
      _sum: { quantityAvailable: true },
    });
    const availMap = new Map<string, Prisma.Decimal>(
      availability.map((a) => [
        a.productId,
        a._sum.quantityAvailable ?? new Prisma.Decimal(0),
      ]),
    );
    const skuById = new Map(products.map((p) => [p.id, p.sku]));

    for (const [productId, requested] of requestedByProduct) {
      const available = availMap.get(productId) ?? new Prisma.Decimal(0);
      if (requested.greaterThan(available)) {
        const sku = skuById.get(productId) ?? productId;
        throw new BadRequestException(
          `Insufficient stock for ${sku}: requested ${requested.toString()}, available ${available.toString()}.`,
        );
      }
    }
  }

  async findById(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    const timeline = await this.events.listForOrder(order.id);
    const reservations = order.outboundOrderId
      ? await this.prisma.stockReservation.findMany({
          where: { outboundOrderId: order.outboundOrderId },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return {
      ...serializeOmsOrder(order),
      timeline,
      reservations: reservations.map((r) => ({
        ...r,
        quantity: r.quantity.toString(),
      })),
    };
  }

  async update(id: string, user: AuthPrincipal, dto: UpdateOmsOrderDto) {
    const existing = await this.resolveOrder(id, user);
    const contact = assertAndNormalizeRecipientContact(dto);
    const destination =
      dto.destinationAddress !== undefined
        ? composeDestinationAddress({
            destinationAddress: dto.destinationAddress,
            addressLine1: dto.addressLine1 ?? existing.addressLine1 ?? undefined,
            addressLine2: dto.addressLine2 ?? existing.addressLine2 ?? undefined,
            district: dto.district ?? existing.district ?? undefined,
            city: dto.city ?? existing.city ?? undefined,
          })
        : undefined;

    let incompletePatch: {
      needsInformation?: boolean;
      city?: string | null;
      district?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      shippingReceiverLat?: number | null;
      shippingReceiverLng?: number | null;
      destinationAddress?: string;
    } = {};
    if (existing.needsInformation) {
      const resolved = await resolveOmsDeliveryLocation(this.geo, {
        governorate: dto.city !== undefined ? dto.city : existing.city,
        city: dto.district !== undefined ? dto.district : existing.district,
        neighborhood: dto.addressLine1 !== undefined ? dto.addressLine1 : existing.addressLine1,
        street: dto.addressLine2 !== undefined ? dto.addressLine2 : existing.addressLine2,
      });
      if (resolved.complete) {
        incompletePatch = {
          needsInformation: false,
          city: resolved.city,
          district: resolved.district,
          addressLine1: resolved.addressLine1,
          addressLine2: resolved.addressLine2,
          shippingReceiverLat: resolved.lat,
          shippingReceiverLng: resolved.lng,
          destinationAddress:
            destination ||
            composeDestinationAddress({
              addressLine1: resolved.addressLine1 ?? undefined,
              addressLine2: resolved.addressLine2 ?? undefined,
              district: resolved.district ?? undefined,
              city: resolved.city ?? undefined,
            }),
        };
      }
    }

    if (dto.outboundOrderId) {
      // Soft-deprecate link-first: new links must go through approve → auto-generate outbound.
      if (!existing.outboundOrderId) {
        throw new BadRequestException(
          'Manual outbound linking is deprecated. Approve the OMS order to generate a warehouse order.',
        );
      }
      await this.assertOutboundLinkable(user, dto.outboundOrderId, existing.companyId, existing.id);
    }

    if (hasShippingConfigPatch(dto)) {
      assertShippingConfigUnlocked(existing.outboundOrder?.status);
    }

    const weightByProductId = new Map(
      existing.lines.map((l) => [
        l.productId,
        (l as { product?: { weightKg?: { toString(): string } | null } }).product?.weightKg?.toString() ??
          null,
      ]),
    );
    const volumeByProductId = new Map(
      existing.lines.map((l) => [
        l.productId,
        (l as { product?: { volumeCbm?: { toString(): string } | null } }).product?.volumeCbm?.toString() ??
          null,
      ]),
    );
    // Prefer product weights/volumes from DB when not already on include.
    if (
      ([...weightByProductId.values()].every((v) => v == null) ||
        [...volumeByProductId.values()].every((v) => v == null)) &&
      existing.lines.length > 0
    ) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: existing.lines.map((l) => l.productId) } },
        select: { id: true, weightKg: true, volumeCbm: true },
      });
      for (const p of products) {
        weightByProductId.set(p.id, p.weightKg?.toString() ?? null);
        volumeByProductId.set(p.id, p.volumeCbm?.toString() ?? null);
      }
    }

    const nextMethod = dto.shippingMethod ?? existing.shippingMethod;
    const lineQty = existing.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity.toString(),
    }));
    const shippingWeightKg = hasShippingConfigPatch(dto)
      ? resolveShippingWeightKg({
          method: nextMethod,
          explicit: dto.shippingWeightKg !== undefined ? dto.shippingWeightKg : existing.shippingWeightKg?.toString(),
          lines: lineQty,
          weightByProductId,
        })
      : undefined;
    const shippingVolumeCbm = hasShippingConfigPatch(dto)
      ? resolveShippingVolumeCbm({
          method: nextMethod,
          explicit:
            dto.shippingVolumeCbm !== undefined
              ? dto.shippingVolumeCbm
              : (existing as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm?.toString(),
          lines: lineQty,
          volumeByProductId,
        })
      : undefined;

    const shippingPatch = hasShippingConfigPatch(dto)
      ? {
          shippingMethod: dto.shippingMethod,
          shippingProviderCode: dto.shippingProviderCode,
          shippingReceiverLat: dto.shippingReceiverLat,
          shippingReceiverLng: dto.shippingReceiverLng,
          shippingPackageType: dto.shippingPackageType,
          shippingContents: dto.shippingContents,
          shippingDeliveryType: dto.shippingDeliveryType,
          shippingPickupType: dto.shippingPickupType,
          shippingPayer: dto.shippingPayer,
          shippingWeightKg:
            dto.shippingWeightKg !== undefined
              ? dto.shippingWeightKg
              : shippingWeightKg !== undefined
                ? shippingWeightKg
                : undefined,
          shippingVolumeCbm:
            dto.shippingVolumeCbm !== undefined
              ? dto.shippingVolumeCbm
              : shippingVolumeCbm !== undefined
                ? shippingVolumeCbm
                : undefined,
          shippingPhoneCountry:
            contact.shippingPhoneCountry !== undefined
              ? contact.shippingPhoneCountry
              : dto.shippingPhoneCountry,
        }
      : null;

    if (shippingPatch) {
      const nextFields = {
        shippingMethod: nextMethod,
        shippingProviderCode:
          dto.shippingProviderCode !== undefined
            ? dto.shippingProviderCode
            : existing.shippingProviderCode,
        shippingReceiverLat:
          dto.shippingReceiverLat !== undefined
            ? dto.shippingReceiverLat
            : (existing.shippingReceiverLat?.toString() ?? null),
        shippingReceiverLng:
          dto.shippingReceiverLng !== undefined
            ? dto.shippingReceiverLng
            : (existing.shippingReceiverLng?.toString() ?? null),
        shippingPackageType:
          dto.shippingPackageType !== undefined
            ? dto.shippingPackageType
            : existing.shippingPackageType,
        shippingDeliveryType:
          dto.shippingDeliveryType !== undefined
            ? dto.shippingDeliveryType
            : existing.shippingDeliveryType,
        shippingPickupType:
          dto.shippingPickupType !== undefined
            ? dto.shippingPickupType
            : existing.shippingPickupType,
        shippingWeightKg:
          dto.shippingWeightKg !== undefined
            ? dto.shippingWeightKg
            : (existing.shippingWeightKg?.toString() ?? null),
        shippingVolumeCbm:
          dto.shippingVolumeCbm !== undefined
            ? dto.shippingVolumeCbm
            : ((existing as { shippingVolumeCbm?: { toString(): string } | null })
                .shippingVolumeCbm?.toString() ?? null),
      };
      assertShippingIntentReady(nextFields);
      await this.shipping.assertLiveCarrierSelection({
        fields: nextFields,
        governorate: dto.city ?? existing.city,
        city: dto.district ?? existing.district,
        neighborhood: dto.addressLine1 ?? existing.addressLine1,
      });
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const nextPayment = dto.paymentMethod ?? existing.paymentMethod;
      const nextShipping =
        dto.shippingFee != null
          ? new Prisma.Decimal(dto.shippingFee)
          : (existing.shippingFee ?? new Prisma.Decimal(0));

      const linesSum = existing.lines.reduce((sum, l) => {
        if (l.lineTotal != null) return sum.add(l.lineTotal);
        if (l.unitPrice != null) {
          return sum.add(l.unitPrice.mul(l.requestedQuantity));
        }
        return sum;
      }, new Prisma.Decimal(0));

      // Subtotal = shipping fee + sum of line totals (always recalculated).
      const nextSubtotal =
        dto.subtotal != null
          ? new Prisma.Decimal(dto.subtotal)
          : linesSum.add(nextShipping);

      const nextCod =
        dto.codAmount != null
          ? new Prisma.Decimal(dto.codAmount)
          : nextPayment === 'COD' &&
              (dto.paymentMethod !== undefined ||
                dto.subtotal !== undefined ||
                dto.shippingFee !== undefined)
            ? nextSubtotal
            : undefined;

      const row = await tx.omsOrder.update({
        where: { id: existing.id },
        data: {
          recipientName:
            contact.recipientName !== undefined ? contact.recipientName : dto.recipientName,
          recipientPhone:
            contact.recipientPhone !== undefined ? contact.recipientPhone : dto.recipientPhone,
          ...(contact.shippingPhoneCountry !== undefined
            ? { shippingPhoneCountry: contact.shippingPhoneCountry }
            : {}),
          city: dto.city,
          district: dto.district,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          deliveryInstructions: dto.deliveryInstructions,
          ...(destination ? { destinationAddress: destination } : {}),
          requiredShipDate: dto.requiredShipDate
            ? new Date(dto.requiredShipDate)
            : undefined,
          carrier: dto.carrier,
          trackingNumber: dto.trackingNumber,
          clientReference: dto.clientReference,
          notes: dto.notes,
          paymentMethod: dto.paymentMethod,
          subtotal: nextSubtotal,
          shippingFee:
            dto.shippingFee != null ? new Prisma.Decimal(dto.shippingFee) : undefined,
          ...(nextCod !== undefined ? { codAmount: nextCod } : {}),
          ...(dto.paymentMethod !== undefined
            ? {
                codStatus:
                  deriveCodStatus(nextPayment, nextCod ?? existing.codAmount) ??
                  (nextPayment === 'COD' ? existing.codStatus : null),
              }
            : {}),
          currency: dto.currency,
          storeChannel: dto.storeChannel,
          externalReference: dto.externalReference,
          ...(incompletePatch.needsInformation === false
            ? {
                needsInformation: false,
                city: incompletePatch.city,
                district: incompletePatch.district,
                addressLine1: incompletePatch.addressLine1,
                addressLine2: incompletePatch.addressLine2,
                shippingReceiverLat: incompletePatch.shippingReceiverLat,
                shippingReceiverLng: incompletePatch.shippingReceiverLng,
                ...(incompletePatch.destinationAddress
                  ? { destinationAddress: incompletePatch.destinationAddress }
                  : {}),
              }
            : {}),
          ...(dto.outboundOrderId !== undefined
            ? { outboundOrderId: dto.outboundOrderId }
            : {}),
          ...(shippingPatch ? shippingPrismaData(shippingPatch) : {}),
        },
        include: ORDER_INCLUDE,
      });

      if (shippingPatch && row.outboundOrderId) {
        await tx.outboundOrder.update({
          where: { id: row.outboundOrderId },
          data: {
            ...shippingPrismaData({
              shippingMethod: row.shippingMethod,
              shippingProviderCode: row.shippingProviderCode,
              shippingReceiverLat: row.shippingReceiverLat?.toString() ?? null,
              shippingReceiverLng: row.shippingReceiverLng?.toString() ?? null,
              shippingPackageType: row.shippingPackageType,
              shippingContents: row.shippingContents,
              shippingDeliveryType: row.shippingDeliveryType,
              shippingPickupType: row.shippingPickupType,
              shippingPayer: row.shippingPayer,
              shippingWeightKg: row.shippingWeightKg?.toString() ?? null,
              shippingVolumeCbm: row.shippingVolumeCbm?.toString() ?? null,
              shippingPhoneCountry: row.shippingPhoneCountry,
            }),
            // Keep legacy carrier label in sync when OMS still carries one (display/cache).
            ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
          },
        });
      }

      await this.events.record(tx, {
        omsOrderId: row.id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: dto.outboundOrderId === null ? 'warehouse.unlinked' : 'order.updated',
        createdBy: user.id,
        payload:
          dto.outboundOrderId !== undefined
            ? { outboundOrderId: dto.outboundOrderId }
            : undefined,
      });
      return row;
    });

    this.emitOms('order.updated', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async delete(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);
    await withTenantRls(this.prisma, user, async (tx) => {
      await tx.omsOrder.delete({ where: { id: existing.id } });
    });
    this.emitOms('order.deleted', existing.companyId, existing.id, existing.status);
    return { ok: true };
  }

  async cancel(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);
    if (existing.status === OmsOrderStatus.cancelled) {
      return serializeOmsOrder(existing);
    }
    if (existing.status === OmsOrderStatus.delivered) {
      throw new InvalidStateException('Delivered orders cannot be cancelled.');
    }
    if (
      existing.status === OmsOrderStatus.shipped ||
      existing.status === OmsOrderStatus.out_for_delivery
    ) {
      throw new InvalidStateException(
        'Shipped orders cannot be cancelled. Use failed delivery or return flows.',
      );
    }

    const actor = resolveOmsActorRole(user.role);
    // Clients may cancel only while waiting for confirmation or admin approval.
    // After admin approval (processing+), only admins can cancel.
    if (actor === 'client') {
      const clientCancellable: OmsOrderStatus[] = [
        OmsOrderStatus.waiting_for_confirmation,
        OmsOrderStatus.confirmed_waiting_for_admin_approval,
        OmsOrderStatus.pending_approval,
      ];
      if (!clientCancellable.includes(existing.status)) {
        throw new InvalidStateException(
          'This order has already been approved. Only warehouse admin can cancel it now.',
        );
      }
    }
    assertOmsTransition(existing.status, 'cancel', actor);

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          status: OmsOrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelledBy: user.id,
        },
        include: ORDER_INCLUDE,
      });
      if (row.outboundOrderId) {
        const outbound = await tx.outboundOrder.findUnique({
          where: { id: row.outboundOrderId },
          select: { id: true, status: true, companyId: true },
        });
        if (
          outbound &&
          outbound.status !== OutboundOrderStatus.cancelled &&
          outbound.status !== OutboundOrderStatus.shipped &&
          outbound.status !== OutboundOrderStatus.delivered &&
          outbound.status !== OutboundOrderStatus.out_for_delivery
        ) {
          await tx.outboundOrder.update({
            where: { id: outbound.id },
            data: { status: OutboundOrderStatus.cancelled },
          });
        } else if (
          outbound &&
          (outbound.status === OutboundOrderStatus.shipped ||
            outbound.status === OutboundOrderStatus.delivered ||
            outbound.status === OutboundOrderStatus.out_for_delivery)
        ) {
          throw new InvalidStateException(
            'Cannot cancel OMS while outbound has already left the warehouse.',
          );
        }
      }
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'oms.cancelled',
        createdBy: user.id,
      });
      return row;
    });
    this.emitOms('oms.cancelled', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async allocate(id: string, user: AuthPrincipal, dto: AllocateOmsOrderDto) {
    const order = await this.resolveOrder(id, user);
    if (!order.outboundOrderId) {
      throw new BadRequestException('Link an outbound order before allocating inventory.');
    }
    await withTenantRls(this.prisma, user, async (tx) => {
      await this.allocateLinkedOutbound(tx, user, order.id, order.outboundOrderId!, dto);
    });
    const fresh = await this.resolveOrder(id, user);
    this.emitOms('order.allocated', fresh.companyId, fresh.id, fresh.status);
    this.emitOms('inventory.allocated', fresh.companyId, fresh.id, fresh.status);
    this.realtime.emitInventoryChanged(fresh.companyId, {
      source: 'oms_allocate',
      orderId: fresh.id,
    });
    return serializeOmsOrder(fresh);
  }

  async releaseAllocation(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    if (!order.outboundOrderId) {
      throw new BadRequestException('No linked outbound order.');
    }
    await withTenantRls(this.prisma, user, async (tx) => {
      const full = await tx.outboundOrder.findUnique({ where: { id: order.outboundOrderId! } });
      if (!full) throw new NotFoundException('Linked outbound order not found.');
      await this.allocation.releaseAllocation(tx, {
        outboundOrderId: order.outboundOrderId!,
        companyId: full.companyId,
        actorUserId: user.id,
      });
      await tx.omsOrder.update({
        where: { id: order.id },
        data: { allocationStatus: 'released' },
      });
      await this.events.record(tx, {
        omsOrderId: order.id,
        outboundOrderId: order.outboundOrderId!,
        companyId: order.companyId,
        eventType: 'inventory.released',
        createdBy: user.id,
      });
    });
    const fresh = await this.resolveOrder(id, user);
    this.emitOms('inventory.released', fresh.companyId, fresh.id, fresh.status);
    this.realtime.emitInventoryChanged(fresh.companyId, {
      source: 'oms_release_allocation',
      orderId: fresh.id,
    });
    return serializeOmsOrder(fresh);
  }

  async markOutForDelivery(id: string, user: AuthPrincipal) {
    // Deprecated as a free commercial transition — WMS sync owns shipped.
    // Kept for compatibility: only allow moving into shipped from prep states.
    return this.transition(id, user, {
      allowed: [
        OmsOrderStatus.processing,
        OmsOrderStatus.pending,
        OmsOrderStatus.ready_to_ship,
        OmsOrderStatus.allocated,
        OmsOrderStatus.picking,
        OmsOrderStatus.packing,
        OmsOrderStatus.approved,
      ],
      next: OmsOrderStatus.shipped,
      event: 'oms.shipped',
      extra: { outForDeliveryAt: new Date() },
    });
  }

  /**
   * Record commercial fulfillment outside the warehouse.
   * Same NEW path for future admins and for migrated B7b-style rows after normalization.
   * Does not allocate, deduct, create tasks, or call carriers.
   */
  async recordExternalFulfillment(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);

    if (
      existing.status === OmsOrderStatus.shipped &&
      existing.outboundOrder?.status === OutboundOrderStatus.externally_fulfilled
    ) {
      return serializeOmsOrder(existing);
    }

    assertOmsTransition(existing.status, 'record_external_fulfillment' as never, 'admin');

    if (!existing.outboundOrderId) {
      throw new InvalidStateException(
        'External fulfillment requires a linked outbound order. Approve the order first.',
      );
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const outbound = await tx.outboundOrder.findUnique({
        where: { id: existing.outboundOrderId! },
        select: { id: true, status: true },
      });
      if (!outbound) {
        throw new NotFoundException('Linked outbound order not found.');
      }
      if (
        outbound.status !== OutboundOrderStatus.draft &&
        outbound.status !== OutboundOrderStatus.allocated &&
        outbound.status !== OutboundOrderStatus.pending_approval &&
        outbound.status !== OutboundOrderStatus.externally_fulfilled
      ) {
        throw new InvalidStateException(
          `External fulfillment is only allowed while outbound is draft/allocated (current: ${outbound.status}).`,
        );
      }

      if (outbound.status !== OutboundOrderStatus.externally_fulfilled) {
        await tx.outboundOrder.update({
          where: { id: outbound.id },
          data: { status: OutboundOrderStatus.externally_fulfilled },
        });
      }

      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          status: OmsOrderStatus.shipped,
          outForDeliveryAt: existing.outForDeliveryAt ?? new Date(),
        },
        include: ORDER_INCLUDE,
      });

      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: outbound.id,
        companyId: row.companyId,
        eventType: 'oms.externally_fulfilled',
        createdBy: user.id,
        payload: {
          omsFrom: existing.status,
          omsTo: OmsOrderStatus.shipped,
          outboundFrom: outbound.status,
          outboundTo: OutboundOrderStatus.externally_fulfilled,
        },
      });
      return row;
    });

    this.emitOms('oms.externally_fulfilled', updated.companyId, updated.id, updated.status);
    if (updated.outboundOrderId) {
      this.realtime.emitOutboundOrderUpdated(updated.companyId, {
        orderId: updated.outboundOrderId,
        status: OutboundOrderStatus.externally_fulfilled,
        reason: 'external_fulfillment',
      });
    }
    return serializeOmsOrder(updated);
  }

  async markDelivered(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);

    if (existing.status === OmsOrderStatus.delivered) {
      if (
        existing.paymentMethod === 'COD' &&
        existing.codGenerationStatus !== 'ok'
      ) {
        await this.cod.generateForDeliveredOrder(user, existing.id);
        const refreshed = await this.resolveOrder(id, user);
        return serializeOmsOrder(refreshed);
      }
      return serializeOmsOrder(existing);
    }

    assertOmsTransition(existing.status, 'mark_delivered', 'admin');

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          status: OmsOrderStatus.delivered,
          deliveredAt: new Date(),
          codGenerationStatus:
            existing.paymentMethod === 'COD' ? 'pending' : 'none',
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'oms.delivered',
        createdBy: user.id,
      });
      return row;
    });

    this.emitOms('oms.delivered', updated.companyId, updated.id, updated.status);

    if (updated.paymentMethod === 'COD') {
      try {
        await this.cod.generateForDeliveredOrder(user, updated.id);
      } catch {
        await this.prisma.omsOrder.update({
          where: { id: updated.id },
          data: { codGenerationStatus: 'failed' },
        });
      }
    }

    const fresh = await this.resolveOrder(id, user);
    return serializeOmsOrder(fresh);
  }

  async revertDelivery(
    id: string,
    user: AuthPrincipal,
    dto: { reason: string },
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('A reason is required to revert delivery.');
    }

    const existing = await this.resolveOrder(id, user);
    assertOmsTransition(existing.status, 'delivery_revert', 'admin');

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          status: OmsOrderStatus.shipped,
          deliveredAt: null,
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'oms.delivery_reverted',
        createdBy: user.id,
        payload: { reason, previousStatus: OmsOrderStatus.delivered },
      });
      return row;
    });

    this.emitOms('oms.delivery_reverted', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async markReturned(_id: string, _user: AuthPrincipal) {
    throw new BadRequestException(
      'Use OMS Returns to request a return after Delivered. Direct OMS returned status is deprecated.',
    );
  }

  async collectCod(_id: string, _user: AuthPrincipal) {
    throw new BadRequestException(
      'Use COD module: PATCH /cod/records/:id/status. Legacy collect on OMS order is removed.',
    );
  }

  async settleCod(_id: string, _user: AuthPrincipal) {
    throw new BadRequestException(
      'Use COD module: PATCH /cod/records/:id/status to paid_out. Legacy settle on OMS order is removed.',
    );
  }

  async timeline(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    return this.events.listForOrder(order.id);
  }

  /** Called from outbound.create when OMS extras are supplied — keeps legacy path working. */
  async mirrorFromOutbound(
    tx: Prisma.TransactionClient,
    params: {
      outbound: {
        id: string;
        companyId: string;
        createdBy: string;
        destinationAddress: string;
        requiredShipDate: Date;
        carrier: string | null;
        clientReference: string | null;
        notes: string | null;
        requiresPacking: boolean;
        recipientName: string | null;
        recipientPhone: string | null;
        city: string | null;
        district: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        deliveryInstructions: string | null;
        paymentMethod: string | null;
        subtotal: Prisma.Decimal | null;
        shippingFee: Prisma.Decimal | null;
        codAmount: Prisma.Decimal | null;
        currency: string | null;
        codStatus: string | null;
        allocationStatus: string;
        storeChannel: string | null;
        externalReference: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      };
      lines: Array<{
        productId: string;
        requestedQuantity: Prisma.Decimal;
        specificLotId: string | null;
        lineNumber: number;
        unitPrice: Prisma.Decimal | null;
        lineTotal: Prisma.Decimal | null;
        discountAmount: Prisma.Decimal | null;
      }>;
      actorUserId: string;
      recordEvent?: boolean;
    },
  ) {
    const o = params.outbound;
    const created = await tx.omsOrder.create({
      data: {
        companyId: o.companyId,
        outboundOrderId: o.id,
        destinationAddress: o.destinationAddress,
        requiredShipDate: o.requiredShipDate,
        carrier: o.carrier,
        clientReference: o.clientReference,
        notes: o.notes,
        requiresPacking: o.requiresPacking,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        city: o.city,
        district: o.district,
        addressLine1: o.addressLine1,
        addressLine2: o.addressLine2,
        deliveryInstructions: o.deliveryInstructions,
        paymentMethod: o.paymentMethod as never,
        subtotal: o.subtotal ?? undefined,
        shippingFee: o.shippingFee ?? undefined,
        codAmount: o.codAmount ?? undefined,
        currency: o.currency ?? 'USD',
        codStatus: o.codStatus as never,
        allocationStatus: o.allocationStatus as never,
        storeChannel: o.storeChannel,
        externalReference: o.externalReference,
        status: mapOutboundStatusToOms(o.status) ?? OmsOrderStatus.processing,
        createdBy: o.createdBy,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        lines: {
          create: params.lines.map((line) => ({
            productId: line.productId,
            requestedQuantity: line.requestedQuantity,
            specificLotId: line.specificLotId,
            lineNumber: line.lineNumber,
            unitPrice: line.unitPrice ?? undefined,
            lineTotal: line.lineTotal ?? undefined,
            discountAmount: line.discountAmount ?? undefined,
          })),
        },
      },
    });

    if (params.recordEvent !== false) {
      await this.events.record(tx, {
        omsOrderId: created.id,
        outboundOrderId: o.id,
        companyId: o.companyId,
        eventType: 'order.created',
        createdBy: params.actorUserId,
        payload: { source: 'wms-outbound' },
      });
    }

    return created;
  }

  private async resolveOrder(id: string, user: AuthPrincipal) {
    return withTenantRls(this.prisma, user, async (tx) => {
      let order = await tx.omsOrder.findUnique({
        where: { id },
        include: ORDER_INCLUDE,
      });
      if (!order) {
        order = await tx.omsOrder.findFirst({
          where: { outboundOrderId: id },
          include: ORDER_INCLUDE,
        });
      }
      if (!order) throw new NotFoundException('OMS order not found.');
      this.companyAccess.validateResourceOwnership(user, order);
      return order;
    });
  }

  private async assertOutboundLinkable(
    user: AuthPrincipal,
    outboundOrderId: string,
    companyId: string,
    excludeOmsOrderId?: string,
  ) {
    const outbound = await this.outbound.findById(outboundOrderId, user);
    if (outbound.companyId !== companyId) {
      throw new BadRequestException('Outbound order must belong to the same company.');
    }
    const existing = await this.prisma.omsOrder.findFirst({
      where: {
        outboundOrderId,
        ...(excludeOmsOrderId ? { NOT: { id: excludeOmsOrderId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Outbound order is already linked to another OMS order.');
    }
  }

  private async allocateLinkedOutbound(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    omsOrderId: string,
    outboundOrderId: string,
    dto: AllocateOmsOrderDto,
  ) {
    await this.allocation.assertAllocatable(tx, outboundOrderId);
    const full = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      include: { lines: true },
    });
    if (!full) throw new NotFoundException('Linked outbound order not found.');

    await this.allocation.allocateOrder(tx, {
      outboundOrderId: full.id,
      companyId: full.companyId,
      warehouseId: dto.warehouseId,
      actorUserId: user.id,
      previousStatus: full.status,
      lines: full.lines.map((line) => ({
        outboundOrderLineId: line.id,
        productId: line.productId,
        requestedQty: line.requestedQuantity,
        specificLotId: line.specificLotId,
      })),
    });

    const currentOms = await tx.omsOrder.findUnique({
      where: { id: omsOrderId },
      select: { status: true },
    });
    const keepCommercial =
      currentOms?.status === OmsOrderStatus.processing ||
      currentOms?.status === OmsOrderStatus.ready_to_ship ||
      currentOms?.status === OmsOrderStatus.shipped ||
      currentOms?.status === OmsOrderStatus.out_for_delivery;

    await tx.omsOrder.update({
      where: { id: omsOrderId },
      data: {
        allocationStatus: 'allocated',
        allocatedAt: new Date(),
        ...(keepCommercial ? {} : { status: OmsOrderStatus.processing }),
      },
    });
    await this.events.record(tx, {
      omsOrderId,
      outboundOrderId,
      companyId: full.companyId,
      eventType: 'order.allocated',
      createdBy: user.id,
    });
  }

  private async transition(
    id: string,
    user: AuthPrincipal,
    opts: {
      allowed: OmsOrderStatus[];
      next: OmsOrderStatus;
      event: string;
      extra: Prisma.OmsOrderUpdateInput;
      outboundAllowed?: OutboundOrderStatus[];
      outboundNext?: OutboundOrderStatus;
    },
  ) {
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const cur = await tx.omsOrder.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, cur);
      if (!opts.allowed.includes(cur.status)) {
        throw new InvalidStateException(
          `Cannot transition from ${cur.status} to ${opts.next}.`,
        );
      }

      if (
        cur.outboundOrderId &&
        opts.outboundAllowed &&
        opts.outboundNext
      ) {
        const outbound = await tx.outboundOrder.findUnique({
          where: { id: cur.outboundOrderId },
        });
        if (outbound && opts.outboundAllowed.includes(outbound.status)) {
          await tx.outboundOrder.update({
            where: { id: cur.outboundOrderId },
            data: { status: opts.outboundNext },
          });
          this.realtime.emitOutboundOrderUpdated(outbound.companyId, {
            orderId: outbound.id,
            status: opts.outboundNext,
            listItem: adminOutboundListItem({ ...outbound, status: opts.outboundNext }),
            reason: opts.event,
          });
        }
      }

      const row = await tx.omsOrder.update({
        where: { id },
        data: { status: opts.next, ...opts.extra },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: opts.event,
        createdBy: user.id,
      });
      return row;
    });

    this.emitOms(opts.event, updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  private emitOms(
    event: string,
    companyId: string,
    orderId: string,
    status: string,
  ): void {
    this.realtime.emitOmsOrderEvent(companyId, { orderId, status, event });
  }
}
