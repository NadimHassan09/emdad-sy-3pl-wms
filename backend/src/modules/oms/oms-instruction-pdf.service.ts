import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OmsOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { PdfService } from '../../pdf/pdf.service';
import { parseOutboundExecutionPlan } from '../orders/execution-plan.util';
import { outboundRequiresPacking } from '../outbound/outbound-admin-stages';
import { findWarehouseStockFefo } from '../warehouse-workflow/task-allocation.helper';
import { OMS_LIST_STATUS_EXPANSIONS } from './oms-operational-stage';
import {
  compareOmsOrderNumbers,
  renderInstructionSheetsHtml,
  safeInstructionFilename,
  type InstructionPickRow,
  type InstructionPlace,
  type InstructionSheet,
} from './oms-instruction-sheet';
import { buildBatchInstructionDocument, type BatchInstructionOrder } from './oms-batch-instruction';
import {
  batchInstructionFooterTemplate,
  renderBatchInstructionByKind,
  type BatchInstructionKind,
} from './oms-batch-instruction-sheet';
import { zipBuffers } from './zip-buffers';

const PROCESSING_STATUSES = new Set<OmsOrderStatus>(
  OMS_LIST_STATUS_EXPANSIONS[OmsOrderStatus.processing] ?? [OmsOrderStatus.processing],
);

type PickSlice = {
  productId: string;
  lineId?: string;
  locationId: string;
  quantity: string;
};

@Injectable()
export class OmsInstructionPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async downloadOne(user: AuthPrincipal, orderId: string) {
    const sheet = await this.loadSheet(user, orderId);
    const buffer = await this.pdfService.renderHtml(renderInstructionSheetsHtml([sheet]), {
      format: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return {
      buffer,
      filename: `instructions-${safeInstructionFilename(sheet.orderNumber)}.pdf`,
    };
  }

  /** One PDF, orders in order-number sequence. Each order starts on its own page. */
  async downloadCombined(user: AuthPrincipal, ids: string[]) {
    const sheets = await this.loadSheetsSorted(user, ids);
    const buffer = await this.pdfService.renderHtml(renderInstructionSheetsHtml(sheets), {
      format: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    const day = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `instructions-${day}.pdf` };
  }

  /** One PDF file per order, packed into a zip, ordered by order number. */
  async downloadZip(user: AuthPrincipal, ids: string[]) {
    const sheets = await this.loadSheetsSorted(user, ids);
    const files: Array<{ name: string; data: Buffer }> = [];
    for (const sheet of sheets) {
      const data = await this.pdfService.renderHtml(renderInstructionSheetsHtml([sheet]), {
        format: 'A4',
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      });
      files.push({
        name: `${safeInstructionFilename(sheet.orderNumber)}.pdf`,
        data,
      });
    }
    const day = new Date().toISOString().slice(0, 10);
    return { buffer: zipBuffers(files), filename: `instructions-${day}.zip` };
  }

  /** One aggregated sheet for a saved batch. Does not repeat the single-order template. */
  async downloadBatch(
    user: AuthPrincipal,
    batchId: string,
    kind: BatchInstructionKind = 'full',
  ) {
    const document = await withTenantRls(this.prisma, user, async (tx) => {
      const batch = await tx.omsBatch.findFirst({
        where: {
          id: batchId,
          orders: { some: { order: user.companyId ? { companyId: user.companyId } : {} } },
        },
        include: {
          creator: { select: { fullName: true } },
          orders: {
            where: {
              removedAt: null,
              order: user.companyId ? { companyId: user.companyId } : {},
            },
            include: {
              order: {
                include: {
                  company: { select: { name: true } },
                  outboundOrder: {
                    include: {
                      lines: {
                        orderBy: { lineNumber: 'asc' },
                        include: { product: { select: { id: true, sku: true, name: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!batch) throw new NotFoundException('Batch not found.');
      if (batch.orders.length === 0) {
        throw new BadRequestException('هذه المجموعة لا تحتوي طلبات نشطة.');
      }

      let pickShort = false;
      const orders: BatchInstructionOrder[] = [];
      for (const membership of batch.orders) {
        const order = membership.order;
        const outbound = order.outboundOrder;
        const itemCount = outbound
          ? formatQty(
              outbound.lines
                .reduce((sum, line) => sum.plus(line.requestedQuantity), new Prisma.Decimal(0))
                .toString(),
            )
          : '0';
        const operational = Boolean(outbound) && PROCESSING_STATUSES.has(order.status);
        let picks: BatchInstructionOrder['picks'] = [];
        let packingLocation: InstructionPlace | null = null;
        let dispatchLocation: InstructionPlace | null = null;
        let note = membership.issueNote?.trim() || '';
        if (operational && outbound) {
          const plan = parseOutboundExecutionPlan(outbound.executionPlan);
          const requiresPacking = outboundRequiresPacking({
            requiresPacking: outbound.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
          });
          const warehouseId = await this.resolveWarehouseId(tx, plan?.warehouseId);
          packingLocation = requiresPacking
            ? await this.resolveLocationPlace(tx, plan?.packingLocationId, warehouseId, 'packing')
            : null;
          dispatchLocation =
            (await this.resolveLocationPlace(tx, plan?.dispatchDockId, warehouseId, 'output')) ??
            { name: '—', code: '' };
          const productById = new Map(
            outbound.lines.map((line) => [
              line.productId,
              { sku: line.product?.sku ?? '—', name: line.product?.name ?? '—' },
            ]),
          );
          const lineById = new Map(outbound.lines.map((line) => [line.id, line.productId]));
          const resolved = await this.resolvePickSlices(
            tx,
            outbound.id,
            outbound.lines,
            warehouseId,
            order.companyId,
          );
          if (resolved.short) pickShort = true;
          const locationIds = [...new Set(resolved.slices.map((slice) => slice.locationId).filter(Boolean))];
          const locations =
            locationIds.length === 0
              ? []
              : await tx.location.findMany({
                  where: { id: { in: locationIds } },
                  select: { id: true, fullPath: true, name: true },
                });
          const locationById = new Map(locations.map((loc) => [loc.id, loc]));
          picks = resolved.slices.map((slice) => {
            const productId = slice.productId || (slice.lineId ? lineById.get(slice.lineId) : '') || '';
            const product = productById.get(productId);
            const place = toPlace(locationById.get(slice.locationId));
            return {
              productId,
              sku: product?.sku ?? '—',
              name: product?.name ?? '—',
              quantity: formatQty(slice.quantity),
              locationName: place?.name || '—',
              locationCode: place?.code || '',
            };
          });
        } else if (!note) {
          note = outbound ? 'خارج مرحلة المعالجة' : 'غير مرتبط بمستودع';
        }
        orders.push({
          orderNumber: order.orderNumber,
          customerName: order.recipientName?.trim() || '—',
          customerPhone: order.recipientPhone?.trim() || '',
          companyName: order.company?.name?.trim() || '—',
          itemCount,
          note,
          includeOperations: operational,
          picks,
          packingLocation,
          dispatchLocation,
        });
      }

      return buildBatchInstructionDocument({
        batchNumber: batch.batchNumber,
        batchName: batch.name,
        createdAtLabel: formatOrderDate(batch.createdAt),
        createdByName: batch.creator.fullName?.trim() || '—',
        pickShort,
        orders,
      });
    });
    const buffer = await this.pdfService.renderHtml(renderBatchInstructionByKind(document, kind), {
      format: 'A4',
      preferCSSPageSize: false,
      margin: { top: '12mm', bottom: '22mm', left: '14mm', right: '14mm' },
      footerTemplate: batchInstructionFooterTemplate(),
    });
    const kindSuffix =
      kind === 'picking' ? 'picking-list' : kind === 'packing' ? 'packing-list' : 'instructions';
    return {
      buffer,
      filename: `batch-${kindSuffix}-${safeInstructionFilename(document.batchNumber)}.pdf`,
    };
  }

  private async loadSheetsSorted(user: AuthPrincipal, ids: string[]): Promise<InstructionSheet[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const sheets = await Promise.all(unique.map((id) => this.loadSheet(user, id)));
    return sheets.sort((a, b) => compareOmsOrderNumbers(a.orderNumber, b.orderNumber));
  }

  private async loadSheet(user: AuthPrincipal, orderId: string): Promise<InstructionSheet> {
    return withTenantRls(this.prisma, user, async (tx) => {
      const order = await tx.omsOrder.findFirst({
        where: {
          id: orderId,
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
        include: {
          company: { select: { name: true } },
          creator: { select: { fullName: true } },
          outboundOrder: {
            include: {
              lines: {
                orderBy: { lineNumber: 'asc' },
                include: { product: { select: { id: true, sku: true, name: true } } },
              },
            },
          },
        },
      });
      if (!order) throw new NotFoundException('OMS order not found.');
      if (!PROCESSING_STATUSES.has(order.status)) {
        throw new BadRequestException(
          `تعليمات التنفيذ متاحة فقط للطلبات قيد المعالجة (${order.orderNumber}).`,
        );
      }
      const outbound = order.outboundOrder;
      if (!outbound) {
        throw new BadRequestException(
          `الطلب ${order.orderNumber} غير مرتبط بأمر مستودع.`,
        );
      }

      const plan = parseOutboundExecutionPlan(outbound.executionPlan);
      const requiresPacking = outboundRequiresPacking({
        requiresPacking: outbound.requiresPacking,
        planRequiresPacking: plan?.requiresPacking,
      });
      const warehouseId = await this.resolveWarehouseId(tx, plan?.warehouseId);
      const packingLocation = requiresPacking
        ? await this.resolveLocationPlace(tx, plan?.packingLocationId, warehouseId, 'packing')
        : null;
      const dispatchLocation = await this.resolveLocationPlace(
        tx,
        plan?.dispatchDockId,
        warehouseId,
        'output',
      );

      const productById = new Map(
        outbound.lines.map((line) => [
          line.productId,
          { sku: line.product?.sku ?? '—', name: line.product?.name ?? '—' },
        ]),
      );
      const lineById = new Map(outbound.lines.map((line) => [line.id, line.productId]));

      const resolved = await this.resolvePickSlices(
        tx,
        outbound.id,
        outbound.lines,
        warehouseId,
        order.companyId,
      );
      const slices = resolved.slices;
      const locationIds = [...new Set(slices.map((slice) => slice.locationId).filter(Boolean))];
      const locations =
        locationIds.length === 0
          ? []
          : await tx.location.findMany({
              where: { id: { in: locationIds } },
              select: { id: true, fullPath: true, name: true },
            });
      const locationById = new Map(locations.map((loc) => [loc.id, loc]));

      const picks: InstructionPickRow[] = slices
        .map((slice) => {
          const productId =
            slice.productId || (slice.lineId ? lineById.get(slice.lineId) : '') || '';
          const product = productById.get(productId);
          const loc = locationById.get(slice.locationId);
          const place = toPlace(loc);
          return {
            sku: product?.sku ?? '—',
            name: product?.name ?? '—',
            quantity: formatQty(slice.quantity),
            locationName: place?.name || '—',
            locationCode: place?.code || '',
          };
        })
        .sort(
          (a, b) =>
            a.sku.localeCompare(b.sku) ||
            a.locationName.localeCompare(b.locationName) ||
            a.locationCode.localeCompare(b.locationCode),
        );

      return {
        orderNumber: order.orderNumber,
        orderDate: formatOrderDate(order.createdAt),
        clientName: order.company?.name ?? '',
        operatorName: order.creator?.fullName?.trim() || '—',
        packingLocation,
        dispatchLocation: dispatchLocation ?? { name: '—', code: '' },
        picks,
        pickNote: resolved.short
          ? 'بعض الكميات غير متوفرة بالكامل في المخزون المتاح. راجع الأماكن الظاهرة ثم أعد الطباعة بعد التوفر.'
          : picks.length === 0
            ? 'لم يتم تحديد مواقع الالتقاط بعد. عالج المخزون أو ابدأ مهمة الالتقاط ثم أعد الطباعة.'
            : undefined,
      };
    });
  }

  /**
   * Read-only pick locations. Never reserves stock or writes the execution plan.
   * Prefer the warehouse task snapshot, then active reservations, then a FEFO preview.
   */
  private async resolvePickSlices(
    tx: Prisma.TransactionClient,
    outboundOrderId: string,
    lines: Array<{
      id: string;
      productId: string;
      requestedQuantity: Prisma.Decimal;
      specificLotId: string | null;
    }>,
    warehouseId: string,
    companyId: string,
  ): Promise<{ slices: PickSlice[]; short: boolean }> {
    const tasks = await tx.warehouseTask.findMany({
      where: {
        taskType: 'pick',
        workflowInstance: {
          referenceType: 'outbound_order',
          referenceId: outboundOrderId,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { executionState: true },
    });
    for (const task of tasks) {
      const fromTask = readTaskReservations(task.executionState);
      if (fromTask.length > 0) return { slices: fromTask, short: false };
    }

    const reserved = await tx.stockReservation.findMany({
      where: { outboundOrderId, status: 'active' },
      select: {
        productId: true,
        locationId: true,
        quantity: true,
        outboundOrderLineId: true,
      },
    });
    if (reserved.length > 0) {
      return {
        short: false,
        slices: reserved.map((row) => ({
          productId: row.productId,
          lineId: row.outboundOrderLineId ?? undefined,
          locationId: row.locationId,
          quantity: row.quantity.toString(),
        })),
      };
    }

    if (!warehouseId) return { slices: [], short: false };

    const planned: PickSlice[] = [];
    let short = false;
    for (const line of lines) {
      let remaining = new Prisma.Decimal(line.requestedQuantity.toString());
      const candidates = await findWarehouseStockFefo(
        tx,
        companyId,
        warehouseId,
        line.productId,
        line.specificLotId,
      );
      for (const row of candidates) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
        if (take.lessThanOrEqualTo(0)) continue;
        planned.push({
          productId: line.productId,
          locationId: row.locationId,
          quantity: take.toString(),
        });
        remaining = remaining.minus(take);
      }
      if (remaining.greaterThan(0)) short = true;
    }
    return { slices: planned, short };
  }

  private async resolveWarehouseId(
    tx: Prisma.TransactionClient,
    plannedId?: string,
  ): Promise<string> {
    const explicit = plannedId?.trim();
    if (explicit) return explicit;
    const warehouse = await tx.warehouse.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return warehouse?.id ?? '';
  }

  /**
   * Saved plan location wins (user override or a previously stored default).
   * Otherwise the active default location of that type is used for display only.
   */
  private async resolveLocationPlace(
    tx: Prisma.TransactionClient,
    savedId: string | undefined,
    warehouseId: string,
    type: 'packing' | 'output',
  ): Promise<InstructionPlace | null> {
    const id = savedId?.trim();
    if (id) {
      const saved = await tx.location.findUnique({
        where: { id },
        select: { fullPath: true, name: true },
      });
      const place = toPlace(saved);
      if (place) return place;
    }
    if (!warehouseId) return null;
    const fallback = await tx.location.findFirst({
      where: { warehouseId, type, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { fullPath: true, name: true },
    });
    return toPlace(fallback);
  }
}

function toPlace(
  row: { name: string; fullPath: string } | null | undefined,
): InstructionPlace | null {
  if (!row) return null;
  const name = row.name.trim() || row.fullPath.trim();
  if (!name) return null;
  const path = row.fullPath.trim();
  return { name, code: path && path !== name ? path : '' };
}

function formatOrderDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Damascus',
  }).formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return `${day} ${month} ${year}`.trim();
}

function formatQty(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return Number.isInteger(n) ? String(n) : String(n);
}

function readTaskReservations(state: Prisma.JsonValue | null): PickSlice[] {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  const reservations = (state as { reservations?: unknown }).reservations;
  if (!Array.isArray(reservations)) return [];
  const slices: PickSlice[] = [];
  for (const raw of reservations) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const productId = typeof row.productId === 'string' ? row.productId : '';
    const locationId =
      typeof row.locationId === 'string'
        ? row.locationId
        : typeof row.location_id === 'string'
          ? row.location_id
          : '';
    const quantity =
      row.quantity != null ? String(row.quantity) : row.qty != null ? String(row.qty) : '';
    const lineId =
      typeof row.outboundOrderLineId === 'string'
        ? row.outboundOrderLineId
        : typeof row.outbound_order_line_id === 'string'
          ? row.outbound_order_line_id
          : undefined;
    if (!locationId || !quantity) continue;
    slices.push({ productId, lineId, locationId, quantity });
  }
  return slices;
}
