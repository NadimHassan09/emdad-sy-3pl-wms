import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma, ProductTrackingType } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { isAdjustmentStockLocationType } from '../../common/constants/storage-location-types';
import { InsufficientStockException } from '../../common/errors/domain-exceptions';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { LedgerEntryQueryDto } from './dto/ledger-entry-query.dto';
import { LedgerQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { ledgerSignedQuantity } from './ledger-mapper';
import { StockHelpers } from './stock.helpers';

export interface AvailabilityResult {
  productId: string;
  companyId: string;
  onHand: string;
  reserved: string;
  available: string;
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEDGER_ROW_INCLUDE = {
  company: { select: { id: true, name: true } },
  product: { select: { id: true, sku: true, name: true } },
  lot: { select: { id: true, lotNumber: true } },
  operator: { select: { id: true, fullName: true } },
} as const;

type LedgerRowWithRelations = Prisma.InventoryLedgerGetPayload<{
  include: typeof LEDGER_ROW_INCLUDE;
}>;

type LocationForLabel = {
  id: string;
  name: string;
  fullPath: string;
  barcode: string;
};

const BUSINESS_LEDGER_MOVEMENTS: MovementType[] = [
  MovementType.inbound_receive,
  MovementType.outbound_pick,
  MovementType.adjustment_positive,
  MovementType.adjustment_negative,
];

function expandMovementFilter(
  movementType: LedgerQueryDto['movementType'] | undefined,
): MovementType[] {
  if (!movementType) return BUSINESS_LEDGER_MOVEMENTS;
  if (movementType === 'inbound') return [MovementType.inbound_receive];
  if (movementType === 'outbound') return [MovementType.outbound_pick];
  if (movementType === 'adjustment') {
    return [MovementType.adjustment_positive, MovementType.adjustment_negative];
  }
  return [movementType];
}

function toBusinessMovementType(movementType: MovementType): 'inbound' | 'outbound' | 'adjustment' {
  if (movementType === MovementType.inbound_receive) return 'inbound';
  if (movementType === MovementType.outbound_pick) return 'outbound';
  return 'adjustment';
}

function businessGroupKey(row: {
  id: string;
  referenceType: string;
  referenceId: string;
  productId: string;
  movementType: MovementType;
  idempotencyKey?: string | null;
}): string {
  const parts = row.idempotencyKey?.split(':') ?? [];
  if (parts.length >= 4 && parts[0] === 'bm') {
    return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}`;
  }
  return `${row.referenceType}:${row.referenceId}:${row.productId}:${toBusinessMovementType(row.movementType)}:${row.id}`;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockHelpers: StockHelpers,
  ) {}

  /**
   * Restrict current_stock rows to product/location/lot slices that received inventory
   * on the given inbound order id(s) (ledger-driven).
   */
  private async appendInboundLedgerStockFilter(
    and: Prisma.CurrentStockWhereInput[],
    orderIds: string[],
  ): Promise<void> {
    if (orderIds.length === 0) {
      and.push({ productId: { in: [] } });
      return;
    }
    const legs = await this.prisma.inventoryLedger.findMany({
      where: {
        referenceType: 'inbound_order',
        referenceId: { in: orderIds },
        movementType: 'inbound_receive',
        toLocationId: { not: null },
      },
      select: { productId: true, lotId: true, toLocationId: true },
    });
    const slices = new Map<string, { productId: string; locationId: string; lotId: string | null }>();
    for (const r of legs) {
      if (!r.toLocationId) continue;
      const k = `${r.productId}|${r.lotId ?? '__null'}|${r.toLocationId}`;
      slices.set(k, {
        productId: r.productId,
        locationId: r.toLocationId,
        lotId: r.lotId,
      });
    }
    const orSlices = [...slices.values()].map((s) => ({
      productId: s.productId,
      locationId: s.locationId,
      lotId: s.lotId,
    }));
    if (orSlices.length === 0) {
      and.push({ productId: { in: [] } });
    } else {
      and.push({ OR: orSlices });
    }
  }

  private async resolveCurrentStockWhere(
    user: AuthPrincipal,
    query: StockQueryDto,
  ): Promise<Prisma.CurrentStockWhereInput> {
    const companyId = query.companyId ?? user.companyId ?? undefined;

    const and: Prisma.CurrentStockWhereInput[] = [
      { quantityOnHand: { gt: 0 } },
    ];
    if (companyId) and.push({ companyId });
    if (query.productId) and.push({ productId: query.productId });
    if (query.warehouseId) and.push({ warehouseId: query.warehouseId });

    if (query.locationId) {
      and.push({ locationId: query.locationId });
    } else {
      const locRaw = query.locationBarcodeOrId?.trim();
      if (locRaw) {
        if (UUID_LIKE.test(locRaw)) {
          and.push({ locationId: locRaw });
        } else {
          and.push({
            location: {
              OR: [
                { barcode: { contains: locRaw, mode: 'insensitive' } },
                { fullPath: { contains: locRaw, mode: 'insensitive' } },
              ],
            },
          });
        }
      }
    }

    if (query.packageId) and.push({ packageId: query.packageId });

    if (query.lotNumber?.trim()) {
      and.push({
        lot: {
          lotNumber: { contains: query.lotNumber.trim(), mode: 'insensitive' },
        },
      });
    }

    if (query.sku?.trim()) {
      and.push({
        product: {
          sku: { contains: query.sku.trim(), mode: 'insensitive' },
        },
      });
    }

    if (query.productName?.trim()) {
      and.push({
        product: {
          name: { contains: query.productName.trim(), mode: 'insensitive' },
        },
      });
    }

    if (query.productBarcode?.trim()) {
      const b = query.productBarcode.trim();
      and.push({
        product: {
          AND: [{ barcode: { not: null } }, { barcode: { contains: b, mode: 'insensitive' } }],
        },
      });
    }

    if (query.productSearch?.trim()) {
      const q = query.productSearch.trim();
      and.push({
        product: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (query.inboundOrderId) {
      await this.appendInboundLedgerStockFilter(and, [query.inboundOrderId]);
    } else if (query.inboundOrderNumber?.trim()) {
      const term = query.inboundOrderNumber.trim();
      const whereOrd: Prisma.InboundOrderWhereInput = {
        orderNumber: { contains: term, mode: 'insensitive' },
      };
      if (companyId) whereOrd.companyId = companyId;
      const orders = await this.prisma.inboundOrder.findMany({
        where: whereOrd,
        select: { id: true },
        take: 100,
      });
      await this.appendInboundLedgerStockFilter(
        and,
        orders.map((o) => o.id),
      );
    }

    return and.length === 1 ? and[0]! : { AND: and };
  }

  /**
   * Per-product totals (sum of on-hand across lots/locations) for the main inventory grid.
   */
  async stockByProductSummary(user: AuthPrincipal, query: StockQueryDto) {
    const where = await this.resolveCurrentStockWhere(user, query);

    const grouped = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where,
      _sum: { quantityOnHand: true },
    });

    const productIds = grouped.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { company: { select: { id: true, name: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const rows = grouped
      .map((g) => {
        const p = productMap.get(g.productId);
        if (!p) return null;
        const sum = g._sum.quantityOnHand ?? new Prisma.Decimal(0);
        return {
          productId: g.productId,
          totalQuantity: sum.toString(),
          product: {
            id: p.id,
            sku: p.sku,
            name: p.name,
            uom: p.uom,
            barcode: p.barcode,
          },
          client: { id: p.companyId, name: p.company.name },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => a.product.name.localeCompare(b.product.name));

    const total = rows.length;
    const items = rows.slice(query.offset, query.offset + query.limit);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  /**
   * Real-time stock view (simplified `v_stock_summary`). Joins current_stock
   * to product / location / warehouse / lot for a flat table the UI can
   * render directly.
   */
  async stock(user: AuthPrincipal, query: StockQueryDto) {
    const where = await this.resolveCurrentStockWhere(user, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.currentStock.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          location: {
            select: { id: true, name: true, fullPath: true, barcode: true },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
        },
        orderBy: [{ lastMovementAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.currentStock.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  /**
   * Movement history. In Phase 2 this is routed to the read replica
   * (final_blueprint.md §1.2) — the API contract stays the same.
   */
  async ledger(user: AuthPrincipal, query: LedgerQueryDto) {
    const andParts: Prisma.InventoryLedgerWhereInput[] = [];

    const companyId = query.companyId ?? user.companyId ?? undefined;
    if (companyId) andParts.push({ companyId });
    if (query.productId) andParts.push({ productId: query.productId });
    andParts.push({ movementType: { in: expandMovementFilter(query.movementType) } });
    if (query.referenceType) andParts.push({ referenceType: query.referenceType });
    if (query.referenceId) andParts.push({ referenceId: query.referenceId });

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      andParts.push({ createdAt });
    }

    if (query.warehouseId) {
      const warehouseLocs = await this.prisma.location.findMany({
        where: { warehouseId: query.warehouseId, status: 'active' },
        select: { id: true },
      });
      const locList = warehouseLocs.map((l) => l.id);
      const whPiece: Prisma.InventoryLedgerWhereInput =
        locList.length === 0
          ? { fromLocationId: { in: [] } }
          : {
              OR: [
                { fromLocationId: { in: locList } },
                { toLocationId: { in: locList } },
              ],
            };
      andParts.push(whPiece);
    }

    const where =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0]! : { AND: andParts };

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.inventoryLedger.findMany({
        where,
        include: LEDGER_ROW_INCLUDE,
        orderBy: { createdAt: 'asc' },
        take: Math.max(query.limit * 5, query.limit),
        skip: query.offset,
      }),
      this.prisma.inventoryLedger.count({ where }),
    ]);
    const grouped = new Map<string, LedgerRowWithRelations[]>();
    for (const row of rows) {
      const k = businessGroupKey(row);
      const cur = grouped.get(k) ?? [];
      cur.push(row);
      grouped.set(k, cur);
    }
    const totalsCache = new Map<string, Prisma.Decimal>();
    const groupedRows = [...grouped.values()];
    const groupedItems = await Promise.all(
      groupedRows.map((group) => this.formatBusinessMovementGroup(group, totalsCache)),
    );
    const items = groupedItems
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, query.limit);

    return { items, total: totalRows, limit: query.limit, offset: query.offset };
  }

  /**
   * Single movement detail: one ledger row by composite PK, plus sibling lines that share
   * the same idempotency key (multi-line movements). Optional warehouse scope matches the list.
   */
  async ledgerEntry(user: AuthPrincipal, query: LedgerEntryQueryDto) {
    const createdAt = new Date(query.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Invalid createdAt.');
    }

    const head = await this.prisma.inventoryLedger.findUnique({
      where: { id_createdAt: { id: query.ledgerId, createdAt } },
      include: LEDGER_ROW_INCLUDE,
    });
    if (!head) {
      throw new NotFoundException('Ledger entry not found.');
    }
    if (user.companyId && head.companyId !== user.companyId) {
      throw new NotFoundException('Ledger entry not found.');
    }

    const groupKey = businessGroupKey(head);
    const rows = await this.prisma.inventoryLedger.findMany({
      where: {
        companyId: head.companyId,
        referenceType: head.referenceType,
        referenceId: head.referenceId,
        productId: head.productId,
        movementType: { in: BUSINESS_LEDGER_MOVEMENTS },
      },
      include: LEDGER_ROW_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    let scopedRows = rows.filter((row) => businessGroupKey(row) === groupKey);

    if (query.warehouseId) {
      const warehouseLocs = await this.prisma.location.findMany({
        where: { warehouseId: query.warehouseId, status: 'active' },
        select: { id: true },
      });
      const locSet = new Set(warehouseLocs.map((l) => l.id));
      scopedRows = scopedRows.filter(
        (r) =>
          (r.fromLocationId != null && locSet.has(r.fromLocationId)) ||
          (r.toLocationId != null && locSet.has(r.toLocationId)),
      );
    }

    if (scopedRows.length === 0) {
      throw new NotFoundException('Ledger entry not found in this warehouse.');
    }

    // Inbound detail should reflect where stock ended up after putaway.
    // If the lot/product is split across multiple bins, emit one row per location.
    if (query.warehouseId && head.movementType === MovementType.inbound_receive) {
      const stockSlices = await this.prisma.currentStock.findMany({
        where: {
          companyId: head.companyId,
          warehouseId: query.warehouseId,
          productId: head.productId,
          lotId: head.lotId,
          quantityOnHand: { gt: new Prisma.Decimal(0) },
        },
        select: { locationId: true, quantityOnHand: true },
        orderBy: { quantityOnHand: 'desc' },
      });

      if (stockSlices.length > 0) {
        const locs = await this.prisma.location.findMany({
          where: { id: { in: [...new Set(stockSlices.map((s) => s.locationId))] } },
          select: { id: true, name: true, fullPath: true, barcode: true },
        });
        const locMap = new Map(locs.map((l) => [l.id, l]));

        return {
          lines: stockSlices.map((slice, idx) => {
            const loc = locMap.get(slice.locationId);
            const qty = slice.quantityOnHand.toString();
            return {
              id: `${head.id}:${idx}`,
              createdAt: head.createdAt,
              companyId: head.companyId,
              productId: head.productId,
              lotId: head.lotId,
              idempotencyKey: head.idempotencyKey,
              company: head.company,
              product: head.product,
              lot: head.lot,
              operator: head.operator,
              movementType: head.movementType,
              referenceType: head.referenceType,
              referenceId: head.referenceId,
              quantity: qty,
              quantityChange: qty,
              quantityBefore: null,
              quantityAfter: qty,
              fromLocationId: null,
              toLocationId: slice.locationId,
              locationId: slice.locationId,
              locationLabel: loc ? loc.fullPath || loc.name || loc.barcode : null,
              notes: head.notes,
            };
          }),
        };
      }
    }

    const locMap = await this.buildLedgerLocationMap(scopedRows);
    return { lines: scopedRows.map((row) => this.formatLedgerRow(row, locMap)) };
  }

  private async buildLedgerLocationMap(
    rows: Array<{ fromLocationId: string | null; toLocationId: string | null }>,
  ): Promise<Map<string, LocationForLabel>> {
    const locIds = new Set<string>();
    for (const r of rows) {
      if (r.fromLocationId) locIds.add(r.fromLocationId);
      if (r.toLocationId) locIds.add(r.toLocationId);
    }
    if (locIds.size === 0) return new Map();
    const locs = await this.prisma.location.findMany({
      where: { id: { in: [...locIds] } },
      select: { id: true, name: true, fullPath: true, barcode: true },
    });
    return new Map(locs.map((l) => [l.id, l]));
  }

  private formatLedgerRow(
    row: LedgerRowWithRelations,
    locMap: Map<string, LocationForLabel>,
  ) {
    // Prefer destination bin when available (e.g. putaway should show stored location).
    const locationId = row.toLocationId ?? row.fromLocationId;
    const loc = locationId ? locMap.get(locationId) : undefined;
    const locationLabel =
      loc != null ? loc.fullPath || loc.name || loc.barcode : null;

    return {
      id: row.id,
      createdAt: row.createdAt,
      companyId: row.companyId,
      productId: row.productId,
      lotId: row.lotId,
      idempotencyKey: row.idempotencyKey,
      company: row.company,
      product: row.product,
      lot: row.lot,
      operator: row.operator,
      movementType: row.movementType,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      quantity: row.quantity.toString(),
      quantityChange: ledgerSignedQuantity(row.movementType, row.quantity),
      quantityBefore: row.quantityBefore?.toString() ?? null,
      quantityAfter: row.quantityAfter?.toString() ?? null,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      locationId,
      locationLabel,
      notes: row.notes,
    };
  }

  private async productTotalAfterAt(
    companyId: string,
    productId: string,
    at: Date,
    cache: Map<string, Prisma.Decimal>,
  ): Promise<Prisma.Decimal> {
    const key = `${companyId}:${productId}:${at.toISOString()}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const rows = await this.prisma.inventoryLedger.findMany({
      where: {
        companyId,
        productId,
        movementType: { in: BUSINESS_LEDGER_MOVEMENTS },
        createdAt: { lte: at },
      },
      select: { movementType: true, quantity: true },
    });
    const total = rows.reduce(
      (acc, row) => acc.plus(new Prisma.Decimal(ledgerSignedQuantity(row.movementType, row.quantity))),
      new Prisma.Decimal(0),
    );
    cache.set(key, total);
    return total;
  }

  private async formatBusinessMovementGroup(
    group: LedgerRowWithRelations[],
    totalsCache: Map<string, Prisma.Decimal>,
  ) {
    const ordered = [...group].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const signedDelta = ordered.reduce((sum, row) => {
      const v = Number(ledgerSignedQuantity(row.movementType, row.quantity));
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const afterTotal = await this.productTotalAfterAt(
      first.companyId,
      first.productId,
      last.createdAt,
      totalsCache,
    );
    const beforeTotal = afterTotal.minus(new Prisma.Decimal(signedDelta));
    const before = beforeTotal.toString();
    const after = afterTotal.toString();
    const locationIds = new Set<string>();
    for (const row of ordered) {
      if (row.fromLocationId) locationIds.add(row.fromLocationId);
      if (row.toLocationId) locationIds.add(row.toLocationId);
    }
    const movementType = toBusinessMovementType(first.movementType);
    return {
      id: first.id,
      createdAt: first.createdAt,
      companyId: first.companyId,
      productId: first.productId,
      lotId: first.lotId,
      idempotencyKey: first.idempotencyKey,
      company: first.company,
      product: first.product,
      lot: first.lot,
      operator: first.operator,
      movementType,
      referenceType: first.referenceType,
      referenceId: first.referenceId,
      quantity: new Prisma.Decimal(Math.abs(signedDelta)).toString(),
      quantityChange: signedDelta.toString(),
      quantityBefore: before,
      quantityAfter: after,
      fromLocationId: null as string | null,
      toLocationId: null as string | null,
      locationId: null as string | null,
      locationLabel:
        locationIds.size > 1
          ? `${locationIds.size} affected locations`
          : locationIds.size === 1
            ? '1 affected location'
            : null,
      notes: first.notes,
    };
  }

  /**
   * Move stock between two storage-class locations in the same warehouse.
   * Source and destination types must be `internal` (storage), `fridge`, `quarantine`, or `scrap`.
   */
  async internalTransfer(user: AuthPrincipal, dto: InternalTransferDto) {
    const companyId = dto.companyId ?? user.companyId ?? undefined;
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required (set X-Company-Id, pass companyId, or use a client-scoped user).',
      );
    }
    if (user.companyId && companyId !== user.companyId) {
      throw new NotFoundException('Company not found.');
    }

    const qty = new Prisma.Decimal(dto.quantity.toString());
    if (qty.lte(0)) {
      throw new BadRequestException('quantity must be greater than zero.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          select: { id: true, companyId: true, trackingType: true },
        });
        if (!product || product.companyId !== companyId) {
          throw new BadRequestException('Product must belong to the selected client.');
        }

        let lotId: string | null = dto.lotId ?? null;
        if (product.trackingType === ProductTrackingType.lot) {
          if (!lotId) {
            throw new BadRequestException('lotId is required for lot-tracked products.');
          }
          const lot = await tx.lot.findUnique({
            where: { id: lotId },
            select: { id: true, productId: true },
          });
          if (!lot) throw new NotFoundException('Lot not found.');
          if (lot.productId !== product.id) {
            throw new BadRequestException('Lot does not match product.');
          }
        } else if (lotId) {
          throw new BadRequestException('lotId must not be set for non-lot-tracked products.');
        }

        const fromLoc = await tx.location.findUnique({
          where: { id: dto.fromLocationId },
          select: { id: true, warehouseId: true, type: true, status: true },
        });
        const toLoc = await tx.location.findUnique({
          where: { id: dto.toLocationId },
          select: { id: true, warehouseId: true, type: true, status: true },
        });
        if (!fromLoc || !toLoc) throw new NotFoundException('Location not found.');
        if (fromLoc.id === toLoc.id) {
          throw new BadRequestException('Source and destination locations must differ.');
        }
        if (fromLoc.warehouseId !== toLoc.warehouseId) {
          throw new BadRequestException('Internal transfer must stay within one warehouse.');
        }
        assertLocationUsableForInventoryMove(fromLoc.status);
        assertLocationUsableForInventoryMove(toLoc.status);
        if (!isAdjustmentStockLocationType(fromLoc.type)) {
          throw new BadRequestException(
            'Source must be storage, fridge, quarantine, or scrap.',
          );
        }
        if (!isAdjustmentStockLocationType(toLoc.type)) {
          throw new BadRequestException(
            'Destination must be storage, fridge, quarantine, or scrap.',
          );
        }

        const dec = await this.stockHelpers.decrementWithMeta(tx, {
          companyId,
          productId: dto.productId,
          locationId: dto.fromLocationId,
          lotId,
          quantity: qty.toString(),
        });

        const inc = await this.stockHelpers.upsertPositiveWithMeta(tx, {
          companyId,
          productId: dto.productId,
          locationId: dto.toLocationId,
          warehouseId: toLoc.warehouseId,
          lotId,
          quantity: qty.toString(),
        });

        const referenceId = randomUUID();
        const ledgerRow = await tx.inventoryLedger.create({
          data: {
            companyId,
            productId: dto.productId,
            lotId,
            fromLocationId: dto.fromLocationId,
            toLocationId: dto.toLocationId,
            movementType: 'internal_transfer',
            quantity: qty,
            quantityBefore: dec.before,
            quantityAfter: inc.after,
            referenceType: 'transfer',
            referenceId,
            operatorId: user.id,
          },
          include: LEDGER_ROW_INCLUDE,
        });

        const locMap = await this.buildLedgerLocationMap([ledgerRow]);
        return {
          referenceId,
          ledger: this.formatLedgerRow(ledgerRow, locMap),
        };
      });
    } catch (e) {
      if (e instanceof InsufficientStockException) {
        throw new BadRequestException(
          'Insufficient available quantity at the source location for this product/lot.',
        );
      }
      throw e;
    }
  }

  /**
   * Aggregated stock availability for a single (company, product) tuple.
   * Used by the outbound creation modal to validate quantities client-side
   * before submitting (the backend create endpoint re-validates server-side).
   */
  async availability(
    user: AuthPrincipal,
    productId: string,
    companyIdParam?: string,
  ): Promise<AvailabilityResult> {
    const companyId = companyIdParam ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId is required.');
    }

    const agg = await this.prisma.currentStock.aggregate({
      where: { companyId, productId, status: 'available' },
      _sum: {
        quantityOnHand: true,
        quantityReserved: true,
        quantityAvailable: true,
      },
    });

    return {
      productId,
      companyId,
      onHand: (agg._sum.quantityOnHand ?? new Prisma.Decimal(0)).toString(),
      reserved: (agg._sum.quantityReserved ?? new Prisma.Decimal(0)).toString(),
      available: (
        agg._sum.quantityAvailable ?? new Prisma.Decimal(0)
      ).toString(),
    };
  }
}
