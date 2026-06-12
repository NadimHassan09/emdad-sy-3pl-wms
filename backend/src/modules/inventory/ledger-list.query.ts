import { MovementType, Prisma } from '@prisma/client';

import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerQueryDto } from './dto/stock-query.dto';

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

/** Matches `businessGroupKey()` in inventory.service.ts */
export function ledgerBusinessGroupKeySql(alias = 'il'): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`
    CASE
      WHEN ${a}.idempotency_key IS NOT NULL
           AND split_part(${a}.idempotency_key, ':', 1) = 'bm'
           AND cardinality(string_to_array(${a}.idempotency_key, ':')) >= 4
      THEN split_part(${a}.idempotency_key, ':', 1) || ':' ||
           split_part(${a}.idempotency_key, ':', 2) || ':' ||
           split_part(${a}.idempotency_key, ':', 3) || ':' ||
           split_part(${a}.idempotency_key, ':', 4)
      ELSE ${a}.reference_type::text || ':' || ${a}.reference_id::text || ':' ||
           ${a}.product_id::text || ':' ||
           CASE ${a}.movement_type
             WHEN 'inbound_receive' THEN 'inbound'
             WHEN 'outbound_pick' THEN 'outbound'
             ELSE 'adjustment'
           END || ':' || ${a}.id::text
    END
  `;
}

/** Matches `ledgerSignedQuantity()` for business movement types. */
export function ledgerSignedQuantitySql(alias = 'il'): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`
    CASE
      WHEN ${a}.movement_type IN (
        'outbound_pick', 'adjustment_negative', 'scrap', 'transit_out', 'qc_quarantine'
      ) THEN -${a}.quantity
      ELSE ${a}.quantity
    END
  `;
}

export type LedgerListSqlContext = {
  joins: Prisma.Sql;
  where: Prisma.Sql;
};

export type LedgerGroupPageRow = {
  id: string;
  created_at: Date;
  company_id: string;
  company_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  lot_id: string | null;
  lot_number: string | null;
  idempotency_key: string | null;
  movement_type: MovementType;
  reference_type: string;
  reference_id: string;
  operator_id: string;
  operator_full_name: string;
  notes: string | null;
  quantity_before: string | null;
  quantity_after: string | null;
  signed_delta: string;
  loc_count: number;
};

export async function buildLedgerListSqlContext(
  _prisma: PrismaService,
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  query: LedgerQueryDto,
): Promise<LedgerListSqlContext> {
  const companyId = readCompanyIdFilterRequired(companyAccess, user, query.companyId);
  const joins: Prisma.Sql[] = [
    Prisma.sql`INNER JOIN companies c ON c.id = il.company_id`,
    Prisma.sql`INNER JOIN products p ON p.id = il.product_id`,
    Prisma.sql`LEFT JOIN lots l ON l.id = il.lot_id`,
    Prisma.sql`INNER JOIN users u ON u.id = il.operator_id`,
  ];

  const conditions: Prisma.Sql[] = [
    Prisma.sql`il.company_id = ${companyId}::uuid`,
    Prisma.sql`il.movement_type IN (${Prisma.join(
      expandMovementFilter(query.movementType).map(
        (t) => Prisma.sql`${t}::movement_type`,
      ),
      ', ',
    )})`,
  ];

  if (query.productId) {
    conditions.push(Prisma.sql`il.product_id = ${query.productId}::uuid`);
  } else if (query.sku?.trim()) {
    const pattern = `%${query.sku.trim()}%`;
    conditions.push(Prisma.sql`p.sku ILIKE ${pattern}`);
  } else if (query.productName?.trim()) {
    const pattern = `%${query.productName.trim()}%`;
    conditions.push(Prisma.sql`p.name ILIKE ${pattern}`);
  } else if (query.productBarcode?.trim()) {
    const pattern = `%${query.productBarcode.trim()}%`;
    conditions.push(Prisma.sql`p.barcode IS NOT NULL AND p.barcode ILIKE ${pattern}`);
  } else if (query.productSearch?.trim()) {
    const pattern = `%${query.productSearch.trim()}%`;
    conditions.push(
      Prisma.sql`(
        p.name ILIKE ${pattern}
        OR p.sku ILIKE ${pattern}
        OR (p.barcode IS NOT NULL AND p.barcode ILIKE ${pattern})
      )`,
    );
  }

  if (query.referenceType) {
    conditions.push(Prisma.sql`il.reference_type = ${query.referenceType}::ledger_ref_type`);
  }
  if (query.referenceId) {
    conditions.push(Prisma.sql`il.reference_id = ${query.referenceId}::uuid`);
  }

  if (query.createdFrom) {
    conditions.push(
      Prisma.sql`il.created_at >= ${new Date(`${query.createdFrom}T00:00:00.000Z`)}::timestamptz`,
    );
  }
  if (query.createdTo) {
    conditions.push(
      Prisma.sql`il.created_at <= ${new Date(`${query.createdTo}T23:59:59.999Z`)}::timestamptz`,
    );
  }

  if (query.warehouseId) {
    conditions.push(Prisma.sql`(
      il.from_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = ${query.warehouseId}::uuid
           AND status = 'active'
      )
      OR il.to_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = ${query.warehouseId}::uuid
           AND status = 'active'
      )
    )`);
  }

  return {
    joins: Prisma.join(joins, ' '),
    where: Prisma.join(conditions, ' AND '),
  };
}

/** Count distinct business movement groups (pagination unit). */
export function ledgerBusinessGroupsCountSql(ctx: LedgerListSqlContext): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*)::int AS total
      FROM (
        SELECT ${ledgerBusinessGroupKeySql('il')} AS group_key
          FROM inventory_ledger il
          ${ctx.joins}
         WHERE ${ctx.where}
         GROUP BY ${ledgerBusinessGroupKeySql('il')}
      ) grouped
  `;
}

const LEDGER_GROUP_PAGE_CTE = (ctx: LedgerListSqlContext) => Prisma.sql`
  WITH filtered AS (
    SELECT
      il.id,
      il.created_at,
      il.company_id,
      il.product_id,
      il.lot_id,
      il.idempotency_key,
      il.movement_type,
      il.reference_type,
      il.reference_id,
      il.quantity_before,
      il.quantity_after,
      il.from_location_id,
      il.to_location_id,
      il.notes,
      il.operator_id,
      ${ledgerSignedQuantitySql('il')} AS signed_qty,
      ${ledgerBusinessGroupKeySql('il')} AS group_key,
      c.name AS company_name,
      p.sku AS product_sku,
      p.name AS product_name,
      l.lot_number,
      u.full_name AS operator_full_name
      FROM inventory_ledger il
      ${ctx.joins}
     WHERE ${ctx.where}
  ),
  location_ids AS (
    SELECT f.group_key, v.loc_id
      FROM filtered f
      CROSS JOIN LATERAL (VALUES (f.from_location_id), (f.to_location_id)) AS v(loc_id)
     WHERE v.loc_id IS NOT NULL
  ),
  loc_counts AS (
    SELECT group_key, COUNT(DISTINCT loc_id)::int AS loc_count
      FROM location_ids
     GROUP BY group_key
  ),
  groups AS (
    SELECT
      f.group_key,
      (array_agg(f.id ORDER BY f.created_at ASC, f.id ASC))[1] AS id,
      (array_agg(f.created_at ORDER BY f.created_at ASC, f.id ASC))[1] AS created_at,
      (array_agg(f.company_id ORDER BY f.created_at ASC, f.id ASC))[1] AS company_id,
      (array_agg(f.company_name ORDER BY f.created_at ASC, f.id ASC))[1] AS company_name,
      (array_agg(f.product_id ORDER BY f.created_at ASC, f.id ASC))[1] AS product_id,
      (array_agg(f.product_sku ORDER BY f.created_at ASC, f.id ASC))[1] AS product_sku,
      (array_agg(f.product_name ORDER BY f.created_at ASC, f.id ASC))[1] AS product_name,
      (array_agg(f.lot_id ORDER BY f.created_at ASC, f.id ASC))[1] AS lot_id,
      (array_agg(f.lot_number ORDER BY f.created_at ASC, f.id ASC))[1] AS lot_number,
      (array_agg(f.idempotency_key ORDER BY f.created_at ASC, f.id ASC))[1] AS idempotency_key,
      (array_agg(f.movement_type ORDER BY f.created_at ASC, f.id ASC))[1] AS movement_type,
      (array_agg(f.reference_type ORDER BY f.created_at ASC, f.id ASC))[1] AS reference_type,
      (array_agg(f.reference_id ORDER BY f.created_at ASC, f.id ASC))[1] AS reference_id,
      (array_agg(f.operator_id ORDER BY f.created_at ASC, f.id ASC))[1] AS operator_id,
      (array_agg(f.operator_full_name ORDER BY f.created_at ASC, f.id ASC))[1] AS operator_full_name,
      (array_agg(f.notes ORDER BY f.created_at ASC, f.id ASC))[1] AS notes,
      (array_agg(f.quantity_before ORDER BY f.created_at ASC, f.id ASC))[1] AS quantity_before,
      (array_agg(f.quantity_after ORDER BY f.created_at DESC, f.id DESC))[1] AS quantity_after,
      SUM(f.signed_qty)::text AS signed_delta,
      COALESCE(MAX(lc.loc_count), 0)::int AS loc_count
      FROM filtered f
      LEFT JOIN loc_counts lc ON lc.group_key = f.group_key
     GROUP BY f.group_key
  )
`;

export type LedgerEntrySiblingRow = {
  id: string;
  created_at: Date;
  company_id: string;
  company_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  lot_id: string | null;
  lot_number: string | null;
  idempotency_key: string | null;
  movement_type: MovementType;
  reference_type: string;
  reference_id: string;
  quantity: string;
  quantity_before: string | null;
  quantity_after: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  operator_id: string;
  operator_full_name: string;
  notes: string | null;
};

export function ledgerEntrySiblingRowsSql(input: {
  companyId: string;
  referenceType: string;
  referenceId: string;
  productId: string;
  groupKey: string;
  warehouseId?: string;
}): Prisma.Sql {
  const warehouseCond = input.warehouseId
    ? Prisma.sql`AND (
        il.from_location_id IN (
          SELECT id FROM locations
           WHERE warehouse_id = ${input.warehouseId}::uuid AND status = 'active'
        )
        OR il.to_location_id IN (
          SELECT id FROM locations
           WHERE warehouse_id = ${input.warehouseId}::uuid AND status = 'active'
        )
      )`
    : Prisma.sql``;

  return Prisma.sql`
    SELECT
      il.id,
      il.created_at,
      il.company_id,
      c.name AS company_name,
      il.product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      il.lot_id,
      l.lot_number,
      il.idempotency_key,
      il.movement_type,
      il.reference_type::text AS reference_type,
      il.reference_id,
      il.quantity::text AS quantity,
      il.quantity_before::text AS quantity_before,
      il.quantity_after::text AS quantity_after,
      il.from_location_id,
      il.to_location_id,
      il.operator_id,
      u.full_name AS operator_full_name,
      il.notes
      FROM inventory_ledger il
      INNER JOIN companies c ON c.id = il.company_id
      INNER JOIN products p ON p.id = il.product_id
      LEFT JOIN lots l ON l.id = il.lot_id
      INNER JOIN users u ON u.id = il.operator_id
     WHERE il.company_id = ${input.companyId}::uuid
       AND il.reference_type = ${input.referenceType}::ledger_ref_type
       AND il.reference_id = ${input.referenceId}::uuid
       AND il.product_id = ${input.productId}::uuid
       AND il.movement_type IN (
         'inbound_receive'::movement_type,
         'outbound_pick'::movement_type,
         'adjustment_positive'::movement_type,
         'adjustment_negative'::movement_type
       )
       AND ${ledgerBusinessGroupKeySql('il')} = ${input.groupKey}
       ${warehouseCond}
     ORDER BY il.created_at ASC, il.id ASC
  `;
}

export function ledgerBusinessGroupPageSql(
  ctx: LedgerListSqlContext,
  limit: number,
  offset: number,
): Prisma.Sql {
  return Prisma.sql`
    ${LEDGER_GROUP_PAGE_CTE(ctx)}
    SELECT
      id,
      created_at,
      company_id,
      company_name,
      product_id,
      product_sku,
      product_name,
      lot_id,
      lot_number,
      idempotency_key,
      movement_type,
      reference_type,
      reference_id,
      operator_id,
      operator_full_name,
      notes,
      quantity_before::text AS quantity_before,
      quantity_after::text AS quantity_after,
      signed_delta,
      loc_count
      FROM groups
     ORDER BY created_at DESC
     LIMIT ${limit}
    OFFSET ${offset}
  `;
}
