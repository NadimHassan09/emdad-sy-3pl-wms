import { DocumentType, Prisma } from '@prisma/client';

import type { ContractCatalogRow } from './contracts-catalog.types';

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ListContractCatalogParams = {
  companyId?: string;
  search?: string;
  type?: DocumentType;
  referenceType?: 'inbound_order' | 'outbound_order';
  createdFrom?: string;
  createdTo?: string;
  /** Rows missing at least one language version. */
  pendingOnly?: boolean;
  /** Rows with both EN and AR generated. */
  completeOnly?: boolean;
  /** Rows with at least one generated language version. */
  generatedOnly?: boolean;
  /** Row must have a generated document in this language. */
  language?: 'en' | 'ar';
  /** Row must be missing this language version. */
  missingLanguage?: 'en' | 'ar';
  limit: number;
  offset: number;
};

type EnrichedSlotRow = {
  task_id: string;
  doc_type: DocumentType;
  reference_type: 'inbound_order' | 'outbound_order';
  reference_id: string;
  company_id: string;
  company_name: string;
  completed_at: Date | null;
  order_number: string | null;
  en_id: string | null;
  en_number: string | null;
  en_size: number | null;
  en_created: Date | null;
  ar_id: string | null;
  ar_number: string | null;
  ar_size: number | null;
  ar_created: Date | null;
};

function includesReceiving(type?: DocumentType, referenceType?: string): boolean {
  if (type === DocumentType.delivery_note) return false;
  if (referenceType === 'outbound_order') return false;
  return true;
}

function includesDispatch(type?: DocumentType, referenceType?: string): boolean {
  if (type === DocumentType.grn) return false;
  if (referenceType === 'inbound_order') return false;
  return true;
}

function buildSearchFilter(
  t: string,
  orderColumn: 'io.order_number' | 'oo.order_number',
): Prisma.Sql {
  const pattern = `%${t}%`;
  if (FULL_UUID.test(t)) {
    return Prisma.sql`AND (
      t.id = ${t}::uuid
      OR wi.reference_id = ${t}::uuid
      OR ${Prisma.raw(orderColumn)} ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM documents d
         WHERE d.task_id = t.id
           AND (d.document_number ILIKE ${pattern} OR d.id = ${t}::uuid)
      )
    )`;
  }
  return Prisma.sql`AND (
    ${Prisma.raw(orderColumn)} ILIKE ${pattern}
    OR EXISTS (
      SELECT 1 FROM documents d
       WHERE d.task_id = t.id
         AND d.document_number ILIKE ${pattern}
    )
  )`;
}

export async function listContractCatalogSlots(
  tx: Prisma.TransactionClient,
  params: ListContractCatalogParams,
): Promise<{ rows: ContractCatalogRow[]; total: number }> {
  const companyFilter = params.companyId
    ? Prisma.sql`AND wi.company_id = ${params.companyId}::uuid`
    : Prisma.empty;

  const completedFrom = params.createdFrom
    ? Prisma.sql`AND t.completed_at >= ${`${params.createdFrom}T00:00:00.000Z`}::timestamptz`
    : Prisma.empty;
  const completedTo = params.createdTo
    ? Prisma.sql`AND t.completed_at <= ${`${params.createdTo}T23:59:59.999Z`}::timestamptz`
    : Prisma.empty;

  const unions: Prisma.Sql[] = [];

  if (includesReceiving(params.type, params.referenceType)) {
    const searchFilter = params.search?.trim()
      ? buildSearchFilter(params.search.trim(), 'io.order_number')
      : Prisma.empty;
    unions.push(Prisma.sql`
      SELECT
        t.id AS task_id,
        'grn'::document_type AS doc_type,
        'inbound_order'::text AS reference_type,
        wi.reference_id,
        wi.company_id,
        c.name AS company_name,
        t.completed_at,
        io.order_number
      FROM warehouse_tasks t
      INNER JOIN workflow_instances wi ON wi.id = t.workflow_instance_id
      INNER JOIN companies c ON c.id = wi.company_id
      LEFT JOIN inbound_orders io ON io.id = wi.reference_id
      WHERE t.task_type = 'receiving'
        AND t.status = 'completed'
        ${companyFilter}
        ${completedFrom}
        ${completedTo}
        ${searchFilter}
    `);
  }

  if (includesDispatch(params.type, params.referenceType)) {
    const searchFilter = params.search?.trim()
      ? buildSearchFilter(params.search.trim(), 'oo.order_number')
      : Prisma.empty;
    unions.push(Prisma.sql`
      SELECT
        t.id AS task_id,
        'delivery_note'::document_type AS doc_type,
        'outbound_order'::text AS reference_type,
        wi.reference_id,
        wi.company_id,
        c.name AS company_name,
        t.completed_at,
        oo.order_number
      FROM warehouse_tasks t
      INNER JOIN workflow_instances wi ON wi.id = t.workflow_instance_id
      INNER JOIN companies c ON c.id = wi.company_id
      LEFT JOIN outbound_orders oo ON oo.id = wi.reference_id
      WHERE t.task_type = 'dispatch'
        AND t.status = 'completed'
        ${companyFilter}
        ${completedFrom}
        ${completedTo}
        ${searchFilter}
    `);
  }

  if (unions.length === 0) {
    return { rows: [], total: 0 };
  }

  const slotsCte = Prisma.sql`
    WITH slots AS (
      ${Prisma.join(unions, ' UNION ALL ')}
    ),
    enriched AS (
      SELECT
        s.*,
        de.id AS en_id,
        de.document_number AS en_number,
        de.file_size AS en_size,
        de.created_at AS en_created,
        da.id AS ar_id,
        da.document_number AS ar_number,
        da.file_size AS ar_size,
        da.created_at AS ar_created
      FROM slots s
      LEFT JOIN documents de
        ON de.task_id = s.task_id AND de.type = s.doc_type AND de.language = 'en'
      LEFT JOIN documents da
        ON da.task_id = s.task_id AND da.type = s.doc_type AND da.language = 'ar'
    )
  `;

  const filters: Prisma.Sql[] = [];
  if (params.pendingOnly) {
    filters.push(Prisma.sql`(en_id IS NULL OR ar_id IS NULL)`);
  }
  if (params.completeOnly) {
    filters.push(Prisma.sql`(en_id IS NOT NULL AND ar_id IS NOT NULL)`);
  }
  if (params.generatedOnly) {
    filters.push(Prisma.sql`(en_id IS NOT NULL OR ar_id IS NOT NULL)`);
  }
  if (params.missingLanguage === 'en') {
    filters.push(Prisma.sql`en_id IS NULL`);
  }
  if (params.missingLanguage === 'ar') {
    filters.push(Prisma.sql`ar_id IS NULL`);
  }
  if (params.language === 'en') {
    filters.push(Prisma.sql`en_id IS NOT NULL`);
  }
  if (params.language === 'ar') {
    filters.push(Prisma.sql`ar_id IS NOT NULL`);
  }

  const whereClause =
    filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;

  const countRows = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    ${slotsCte}
    SELECT COUNT(*)::bigint AS total FROM enriched ${whereClause}
  `);
  const total = Number(countRows[0]?.total ?? 0);

  const rawRows = await tx.$queryRaw<EnrichedSlotRow[]>(Prisma.sql`
    ${slotsCte}
    SELECT * FROM enriched
    ${whereClause}
    ORDER BY completed_at DESC NULLS LAST, task_id ASC
    LIMIT ${params.limit}
    OFFSET ${params.offset}
  `);

  return { rows: rawRows.map(mapRow), total };
}

function mapRow(row: EnrichedSlotRow): ContractCatalogRow {
  const en =
    row.en_id && row.en_number && row.en_created
      ? {
          documentId: row.en_id,
          documentNumber: row.en_number,
          fileSize: row.en_size ?? 0,
          createdAt: row.en_created,
          pdfUrl: `/api/documents/${row.en_id}/file`,
        }
      : null;
  const ar =
    row.ar_id && row.ar_number && row.ar_created
      ? {
          documentId: row.ar_id,
          documentNumber: row.ar_number,
          fileSize: row.ar_size ?? 0,
          createdAt: row.ar_created,
          pdfUrl: `/api/documents/${row.ar_id}/file`,
        }
      : null;

  let generationStatus: ContractCatalogRow['generationStatus'] = 'pending';
  if (en && ar) generationStatus = 'complete';
  else if (en || ar) generationStatus = 'partial';

  return {
    slotKey: `${row.doc_type}:${row.task_id}`,
    type: row.doc_type,
    taskId: row.task_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    orderNumber: row.order_number,
    companyId: row.company_id,
    company: { id: row.company_id, name: row.company_name },
    completedAt: row.completed_at,
    generationStatus,
    en,
    ar,
  };
}
