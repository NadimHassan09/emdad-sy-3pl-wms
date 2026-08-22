import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma, ProductTrackingType } from '@prisma/client';

import {
  readCompanyIdFilter,
  readCompanyIdFilterRequired,
} from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { isAdjustmentStockLocationType } from '../../common/constants/storage-location-types';
import { InsufficientStockException } from '../../common/errors/domain-exceptions';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { RealtimeService } from '../realtime/realtime.service';
import { transferPayload } from '../realtime/realtime-ops.payload';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { LedgerEntryQueryDto } from './dto/ledger-entry-query.dto';
import { LedgerQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { ledgerSignedQuantity, toLedgerDisplayMovement } from './ledger-mapper';
import { StockHelpers } from './stock.helpers';
import {
  buildStockByProductSqlContext,
  stockByProductCountSql,
  stockByProductPageSql,
  type StockByProductRow,
} from './stock-by-product.query';
import {
  buildLedgerListSqlContext,
  ledgerBusinessGroupPageSql,
  ledgerBusinessGroupsCountSql,
  ledgerEntrySiblingRowsSql,
  ledgerSignedQuantitySql,
  type LedgerEntrySiblingRow,
  type LedgerGroupPageRow,
} from './ledger-list.query';

export interface AvailabilityResult {
  productId: string;
  companyId: string;
  onHand: string;
  reserved: string;
  /** Global free stock (on_hand - reserved). */
  available: string;
  /**
   * When outboundOrderId was provided: this order's active soft-hold for the product.
   * Usable qty for the order = available + reservedByThisOrder.
   */
  reservedByThisOrder?: string;
  /** When outboundOrderId was provided: available + reservedByThisOrder. */
  availableForOrder?: string;
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

function toBusinessMovementType(
  movementType: MovementType,
): ReturnType<typeof toLedgerDisplayMovement> {
  return toLedgerDisplayMovement(movementType);
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
    private readonly companyAccess: CompanyAccessService,
    private readonly audit: AuditLogService,
    private readonly realtime: RealtimeService,
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
    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);

    const and: Prisma.CurrentStockWhereInput[] = [
      { quantityOnHand: { gt: 0 } },
    ];
    if (companyId) {
      and.push({ companyId });
    }
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

    if (query.status) {
      and.push({ status: query.status });
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
   * Aggregation, sort, and pagination run in PostgreSQL (PERF-P2A).
   */
  async stockByProductSummary(user: AuthPrincipal, query: StockQueryDto) {
    const ctx = await buildStockByProductSqlContext(
      this.prisma,
      this.companyAccess,
      user,
      query,
    );

    return withTenantRls(this.prisma, user, async (tx) => {
      const [countRows, pageRows] = await Promise.all([
        tx.$queryRaw<Array<{ total: number }>>(stockByProductCountSql(ctx)),
        tx.$queryRaw<StockByProductRow[]>(
          stockByProductPageSql(ctx, query.limit, query.offset),
        ),
      ]);

      const total = countRows[0]?.total ?? 0;
      const items = pageRows.map((r) => ({
        productId: r.product_id,
        totalQuantity: r.total_quantity,
        onHand: r.total_quantity,
        reserved: r.reserved_quantity,
        available: r.available_quantity,
        lastMovement: r.last_movement_at
          ? {
              at: r.last_movement_at,
              quantityChange: r.last_quantity_change ?? '0',
              movementType: r.last_movement_type ?? 'inbound_receive',
            }
          : null,
        product: {
          id: r.product_id,
          sku: r.sku,
          name: r.name,
          uom: r.uom,
          barcode: r.barcode,
        },
        client: { id: r.company_id, name: r.company_name },
      }));

      return { items, total, limit: query.limit, offset: query.offset };
    });
  }

  /**
   * Real-time stock view (simplified `v_stock_summary`). Joins current_stock
   * to product / location / warehouse / lot for a flat table the UI can
   * render directly.
   */
  async stock(user: AuthPrincipal, query: StockQueryDto) {
    const where = await this.resolveCurrentStockWhere(user, query);

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total, agg, availAgg] = await Promise.all([
        tx.currentStock.findMany({
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
        tx.currentStock.count({ where }),
        // Aggregate over the FULL matching set (not just the current page) so the
        // UI never under-counts a product whose stock spans more bins than fit on
        // one page. These totals are the canonical on-hand/reserved/available for
        // the requested scope and must match every other product-quantity view.
        tx.currentStock.aggregate({
          where,
          _sum: {
            quantityOnHand: true,
            quantityReserved: true,
          },
        }),
        // Available excludes receiving-area stock awaiting putaway: only
        // `available` status slices can be picked/allocated to outbound.
        tx.currentStock.aggregate({
          where: { AND: [where, { status: 'available' }] },
          _sum: { quantityAvailable: true },
        }),
      ]);

      return {
        items,
        total,
        limit: query.limit,
        offset: query.offset,
        totals: {
          quantityOnHand: (agg._sum.quantityOnHand ?? 0).toString(),
          quantityReserved: (agg._sum.quantityReserved ?? 0).toString(),
          quantityAvailable: (availAgg._sum.quantityAvailable ?? 0).toString(),
        },
      };
    });
  }

  /**
   * Movement history. Business movements are grouped, sorted, and paginated in PostgreSQL (PERF-P2C-B).
   */
  async ledger(user: AuthPrincipal, query: LedgerQueryDto) {
    const ctx = await buildLedgerListSqlContext(
      this.prisma,
      this.companyAccess,
      user,
      query,
    );

    return withTenantRls(this.prisma, user, async (tx) => {
      const [countRows, pageRows] = await Promise.all([
        tx.$queryRaw<Array<{ total: number }>>(ledgerBusinessGroupsCountSql(ctx)),
        tx.$queryRaw<LedgerGroupPageRow[]>(
          ledgerBusinessGroupPageSql(ctx, query.limit, query.offset),
        ),
      ]);

      const total = countRows[0]?.total ?? 0;
      const items = pageRows.map((row) => this.mapLedgerGroupPageRow(row));

      return { items, total, limit: query.limit, offset: query.offset };
    });
  }

  /**
   * Daily on-hand stock level for one product over a date window.
   * Reconstructs from current on-hand minus signed ledger deltas after each day.
   */
  async balanceHistory(
    user: AuthPrincipal,
    query: {
      productId: string;
      companyId?: string;
      warehouseId?: string;
      from: string;
      to: string;
    },
  ) {
    const companyId = readCompanyIdFilterRequired(
      this.companyAccess,
      user,
      query.companyId,
    );
    const fromDay = query.from;
    const toDay = query.to;
    if (fromDay > toDay) {
      throw new BadRequestException('from must be on or before to');
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const stockWhere: Prisma.CurrentStockWhereInput = {
        productId: query.productId,
        ...(companyId ? { companyId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      };
      const agg = await tx.currentStock.aggregate({
        where: stockWhere,
        _sum: { quantityOnHand: true },
      });
      const currentOnHand = Number(agg._sum.quantityOnHand ?? 0);

      const warehouseCond = query.warehouseId
        ? Prisma.sql`AND (
            il.from_location_id IN (
              SELECT id FROM locations
               WHERE warehouse_id = ${query.warehouseId}::uuid AND status = 'active'
            )
            OR il.to_location_id IN (
              SELECT id FROM locations
               WHERE warehouse_id = ${query.warehouseId}::uuid AND status = 'active'
            )
          )`
        : Prisma.sql``;
      const companyCond = companyId
        ? Prisma.sql`AND il.company_id = ${companyId}::uuid`
        : Prisma.sql``;

      // Deltas from start of window through now (needed to walk balances).
      const deltaRows = await tx.$queryRaw<Array<{ day: string; delta: string }>>(Prisma.sql`
        SELECT to_char(date_trunc('day', il.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               SUM(${ledgerSignedQuantitySql('il')})::text AS delta
          FROM inventory_ledger il
         WHERE il.product_id = ${query.productId}::uuid
           ${companyCond}
           ${warehouseCond}
           AND il.movement_type IN (
             'inbound_receive'::movement_type,
             'outbound_pick'::movement_type,
             'return_receive'::movement_type,
             'adjustment_positive'::movement_type,
             'adjustment_negative'::movement_type,
             'scrap'::movement_type
           )
           AND il.created_at >= ${new Date(`${fromDay}T00:00:00.000Z`)}::timestamptz
         GROUP BY 1
         ORDER BY 1 ASC
      `);

      const deltaByDay = new Map(deltaRows.map((r) => [r.day, Number(r.delta)]));
      const sumAfter = (dayInclusive: string): number => {
        let s = 0;
        for (const [day, d] of deltaByDay) {
          if (day > dayInclusive) s += d;
        }
        return s;
      };

      const points: Array<{ day: string; balance: number }> = [];
      const cursor = new Date(`${fromDay}T00:00:00.000Z`);
      const end = new Date(`${toDay}T00:00:00.000Z`);
      while (cursor <= end) {
        const day = cursor.toISOString().slice(0, 10);
        const balance = currentOnHand - sumAfter(day);
        points.push({ day, balance: Math.round(balance * 10000) / 10000 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return {
        productId: query.productId,
        currentOnHand: String(currentOnHand),
        from: fromDay,
        to: toDay,
        points,
      };
    });
  }

  private mapLedgerEntrySiblingRow(row: LedgerEntrySiblingRow): LedgerRowWithRelations {
    return {
      id: row.id,
      createdAt: row.created_at,
      companyId: row.company_id,
      productId: row.product_id,
      lotId: row.lot_id,
      packageId: null,
      fromLocationId: row.from_location_id,
      toLocationId: row.to_location_id,
      movementType: row.movement_type,
      quantity: new Prisma.Decimal(row.quantity),
      quantityBefore: null,
      quantityAfter: null,
      referenceType: row.reference_type as LedgerRowWithRelations['referenceType'],
      referenceId: row.reference_id,
      operatorId: row.operator_id,
      idempotencyKey: row.idempotency_key,
      notes: row.notes,
      company: { id: row.company_id, name: row.company_name },
      product: { id: row.product_id, sku: row.product_sku, name: row.product_name },
      lot: row.lot_id ? { id: row.lot_id, lotNumber: row.lot_number ?? '' } : null,
      operator: { id: row.operator_id, fullName: row.operator_full_name },
    };
  }

  private mapLedgerGroupPageRow(row: LedgerGroupPageRow) {
    const signedDelta = Number(row.signed_delta);
    const movementType = toBusinessMovementType(row.movement_type);
    const locCount = row.loc_count;
    return {
      id: row.id,
      createdAt: row.created_at,
      companyId: row.company_id,
      productId: row.product_id,
      lotId: row.lot_id,
      idempotencyKey: row.idempotency_key,
      company: { id: row.company_id, name: row.company_name },
      product: { id: row.product_id, sku: row.product_sku, name: row.product_name },
      lot: row.lot_id ? { id: row.lot_id, lotNumber: row.lot_number ?? '' } : null,
      operator: { id: row.operator_id, fullName: row.operator_full_name },
      movementType,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      quantity: new Prisma.Decimal(Math.abs(signedDelta)).toString(),
      quantityChange: signedDelta.toString(),
      quantityBefore: null as string | null,
      quantityAfter: null as string | null,
      fromLocationId: null as string | null,
      toLocationId: null as string | null,
      locationId: null as string | null,
      locationLabel:
        locCount > 1
          ? `${locCount} affected locations`
          : locCount === 1
            ? '1 affected location'
            : null,
      notes: row.notes,
    };
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
    this.companyAccess.validateResourceOwnership(user, head);

    const groupKey = businessGroupKey(head);
    const siblingRows = await this.prisma.$queryRaw<LedgerEntrySiblingRow[]>(
      ledgerEntrySiblingRowsSql({
        companyId: head.companyId,
        referenceType: head.referenceType,
        referenceId: head.referenceId,
        productId: head.productId,
        groupKey,
        warehouseId: query.warehouseId,
      }),
    );
    const scopedRows = siblingRows.map((row) => this.mapLedgerEntrySiblingRow(row));

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
              quantityChange: ledgerSignedQuantity(head.movementType, new Prisma.Decimal(qty)),
              quantityBefore: null,
              quantityAfter: null,
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
      quantityBefore: null,
      quantityAfter: null,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      locationId,
      locationLabel,
      notes: row.notes,
    };
  }

  /**
   * Move stock between two storage-class locations in the same warehouse.
   * Source and destination types must be `internal` (storage), `fridge`, `quarantine`, or `scrap`.
   */
  async internalTransfer(user: AuthPrincipal, dto: InternalTransferDto) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);

    const qty = new Prisma.Decimal(dto.quantity.toString());
    if (qty.lte(0)) {
      throw new BadRequestException('quantity must be greater than zero.');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
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
            referenceType: 'transfer',
            referenceId,
            operatorId: user.id,
          },
          include: LEDGER_ROW_INCLUDE,
        });

        const locMap = await this.buildLedgerLocationMap([ledgerRow]);
        await this.audit.logTx(
          tx,
          this.audit.fromPrincipal(user, {
            action: 'INVENTORY_TRANSFERRED',
            resourceType: 'inventory_transfer',
            resourceId: referenceId,
            companyId,
            newState: {
              productId: dto.productId,
              fromLocationId: dto.fromLocationId,
              toLocationId: dto.toLocationId,
              lotId,
              quantity: qty.toString(),
              warehouseId: toLoc.warehouseId,
            },
          }),
        );
        return {
          referenceId,
          ledger: this.formatLedgerRow(ledgerRow, locMap),
          companyId,
          warehouseId: toLoc.warehouseId,
          productId: dto.productId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          lotId,
          quantity: qty.toString(),
        };
      });

      this.realtime.emitTransferCreated(
        result.companyId,
        transferPayload({ ...result, status: 'pending' }),
      );
      this.realtime.emitTransferCompleted(
        result.companyId,
        transferPayload({ ...result, status: 'completed', ledger: result.ledger as Record<string, unknown> }),
      );
      this.realtime.emitInventoryChanged(result.companyId, {
        source: 'internal_transfer',
        productId: result.productId,
      });

      return { referenceId: result.referenceId, ledger: result.ledger };
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
   *
   * When `outboundOrderId` is set, credits that outbound's own active soft-holds
   * so linked OMS→Outbound plans do not treat their own reservation as unavailable.
   */
  async availability(
    user: AuthPrincipal,
    productId: string,
    companyIdParam?: string,
    outboundOrderId?: string,
  ): Promise<AvailabilityResult> {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, companyIdParam);

    const agg = await this.prisma.currentStock.aggregate({
      where: { companyId, productId, status: 'available' },
      _sum: {
        quantityOnHand: true,
        quantityReserved: true,
        quantityAvailable: true,
      },
    });

    const onHand = agg._sum.quantityOnHand ?? new Prisma.Decimal(0);
    const reserved = agg._sum.quantityReserved ?? new Prisma.Decimal(0);
    const available = agg._sum.quantityAvailable ?? new Prisma.Decimal(0);

    const base: AvailabilityResult = {
      productId,
      companyId,
      onHand: onHand.toString(),
      reserved: reserved.toString(),
      available: available.toString(),
    };

    if (!outboundOrderId) return base;

    const order = await this.prisma.outboundOrder.findFirst({
      where: { id: outboundOrderId, companyId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Outbound order not found for availability credit.');
    }

    const ownAgg = await this.prisma.stockReservation.aggregate({
      where: {
        outboundOrderId,
        productId,
        companyId,
        status: 'active',
      },
      _sum: { quantity: true },
    });
    const reservedByThisOrder = ownAgg._sum.quantity ?? new Prisma.Decimal(0);
    const availableForOrder = available.plus(reservedByThisOrder);

    return {
      ...base,
      // Surface usable qty as `available` so existing clients credit own soft-holds.
      available: availableForOrder.toString(),
      reservedByThisOrder: reservedByThisOrder.toString(),
      availableForOrder: availableForOrder.toString(),
    };
  }
}
