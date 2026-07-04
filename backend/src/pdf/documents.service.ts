import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../common/auth/current-user.types';
import {
  readCompanyIdCatalogFilter,
  readCompanyIdFilter,
} from '../common/auth/company-read-scope';
import { CompanyAccessService } from '../common/company-access/company-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { withTenantRls } from '../common/prisma/tenant-rls';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateDocumentInput {
  companyId: string;
  type: DocumentType;
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  taskId: string;
  documentNumber: string;
  fileName: string;
  filePath: string;
  language: string;
  hash: string;
  fileSize: number;
  generatedBy?: string | null;
}

const SEQ: Record<DocumentType, { seq: string; prefix: string }> = {
  [DocumentType.grn]: { seq: 'grn_document_seq', prefix: 'GRN' },
  [DocumentType.delivery_note]: { seq: 'dn_document_seq', prefix: 'DN' },
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  /** Monotonic, human-friendly document number, e.g. GRN-2026-00042. */
  async nextNumber(type: DocumentType): Promise<string> {
    const { seq, prefix } = SEQ[type];
    const rows = await this.prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT nextval('${seq}')::int AS n`,
    );
    const n = rows[0]?.n ?? 1;
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
  }

  findByTask(type: DocumentType, taskId: string, language: string) {
    return this.prisma.document.findFirst({
      where: { type, taskId, language },
    });
  }

  /** Refresh stored PDF bytes after an explicit template re-render (same document id/number). */
  async refreshFile(
    id: string,
    stored: { hash: string; fileSize: number; filePath: string; fileName: string },
  ) {
    return this.prisma.document.update({
      where: { id },
      data: {
        hash: stored.hash,
        fileSize: stored.fileSize,
        filePath: stored.filePath,
        fileName: stored.fileName,
      },
    });
  }

  async create(input: CreateDocumentInput) {
    try {
      return await this.prisma.document.create({ data: input });
    } catch (err) {
      // Concurrent generation: unique (type, task, language) already exists.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findByTask(input.type, input.taskId, input.language);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /** Documents for an order, scoped to the caller's tenant. */
  async listForReference(
    user: AuthPrincipal,
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
  ) {
    const companyId = readCompanyIdFilter(this.companyAccess, user);
    const rows = await this.prisma.document.findMany({
      where: {
        referenceType,
        referenceId,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        taskId: true,
        documentNumber: true,
        language: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({ ...r, pdfUrl: `/api/documents/${r.id}/file` }));
  }

  /** Paginated catalog of GRN / Delivery Note contracts across all orders. */
  async listCatalog(user: AuthPrincipal, query: ListContractsQueryDto) {
    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
    const baseAnd: Prisma.DocumentWhereInput[] = [];
    const where: Prisma.DocumentWhereInput = {};

    if (companyId) where.companyId = companyId;
    if (query.type) where.type = query.type;
    if (query.language) where.language = query.language;
    if (query.referenceType) where.referenceType = query.referenceType;

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (query.search?.trim()) {
      const t = query.search.trim();
      const searchOr: Prisma.DocumentWhereInput[] = [
        { documentNumber: { contains: t, mode: 'insensitive' } },
      ];
      if (FULL_UUID.test(t)) searchOr.push({ id: t });

      const inboundScope: Prisma.InboundOrderWhereInput = {
        orderNumber: { contains: t, mode: 'insensitive' },
        ...(companyId ? { companyId } : {}),
      };
      if (FULL_UUID.test(t)) inboundScope.id = t;

      const outboundScope: Prisma.OutboundOrderWhereInput = {
        orderNumber: { contains: t, mode: 'insensitive' },
        ...(companyId ? { companyId } : {}),
      };
      if (FULL_UUID.test(t)) outboundScope.id = t;

      const [inboundMatches, outboundMatches] = await Promise.all([
        this.prisma.inboundOrder.findMany({
          where: inboundScope,
          select: { id: true },
          take: 200,
        }),
        this.prisma.outboundOrder.findMany({
          where: outboundScope,
          select: { id: true },
          take: 200,
        }),
      ]);

      if (inboundMatches.length) {
        searchOr.push({
          referenceType: 'inbound_order',
          referenceId: { in: inboundMatches.map((row) => row.id) },
        });
      }
      if (outboundMatches.length) {
        searchOr.push({
          referenceType: 'outbound_order',
          referenceId: { in: outboundMatches.map((row) => row.id) },
        });
      }

      baseAnd.push({ OR: searchOr });
    }

    if (baseAnd.length) where.AND = baseAnd;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.document.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { id: true, name: true } },
          },
          take: query.limit,
          skip: query.offset,
        }),
        tx.document.count({ where }),
      ]);

      const inboundIds = items
        .filter((row) => row.referenceType === 'inbound_order')
        .map((row) => row.referenceId);
      const outboundIds = items
        .filter((row) => row.referenceType === 'outbound_order')
        .map((row) => row.referenceId);

      const [inboundOrders, outboundOrders] = await Promise.all([
        inboundIds.length
          ? tx.inboundOrder.findMany({
              where: { id: { in: inboundIds } },
              select: { id: true, orderNumber: true },
            })
          : Promise.resolve([]),
        outboundIds.length
          ? tx.outboundOrder.findMany({
              where: { id: { in: outboundIds } },
              select: { id: true, orderNumber: true },
            })
          : Promise.resolve([]),
      ]);

      const orderNumberByRef = new Map<string, string>();
      for (const order of inboundOrders) {
        orderNumberByRef.set(`inbound_order:${order.id}`, order.orderNumber);
      }
      for (const order of outboundOrders) {
        orderNumberByRef.set(`outbound_order:${order.id}`, order.orderNumber);
      }

      return {
        items: items.map((row) => ({
          id: row.id,
          type: row.type,
          taskId: row.taskId,
          documentNumber: row.documentNumber,
          language: row.language,
          fileName: row.fileName,
          fileSize: row.fileSize,
          createdAt: row.createdAt,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          companyId: row.companyId,
          company: row.company,
          orderNumber:
            orderNumberByRef.get(`${row.referenceType}:${row.referenceId}`) ?? null,
          pdfUrl: `/api/documents/${row.id}/file`,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  /** Resolve a document for download with tenant ownership validation. */
  async getForDownload(user: AuthPrincipal, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found.');
    this.companyAccess.validateResourceOwnership(user, doc);
    return doc;
  }
}
