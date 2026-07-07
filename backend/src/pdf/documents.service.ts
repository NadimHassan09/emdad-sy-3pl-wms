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
import { listContractCatalogSlots } from './contracts-catalog.query';
import type { ContractCatalogRow } from './contracts-catalog.types';

const SEQ: Record<DocumentType, { seq: string; prefix: string }> = {
  [DocumentType.grn]: { seq: 'grn_document_seq', prefix: 'GRN' },
  [DocumentType.delivery_note]: { seq: 'dn_document_seq', prefix: 'DN' },
  [DocumentType.final_contract]: { seq: 'final_contract_document_seq', prefix: 'SWC' },
};

export interface CreateDocumentInput {
  companyId: string;
  type: DocumentType;
  referenceType: 'inbound_order' | 'outbound_order' | 'final_contract';
  referenceId: string;
  taskId?: string | null;
  documentNumber: string;
  fileName: string;
  filePath: string;
  language: string;
  hash: string;
  fileSize: number;
  generatedBy?: string | null;
}

function serializeCatalogRow(row: ContractCatalogRow) {
  return {
    slotKey: row.slotKey,
    type: row.type,
    taskId: row.taskId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    orderNumber: row.orderNumber,
    companyId: row.companyId,
    company: row.company,
    completedAt: row.completedAt?.toISOString() ?? null,
    generationStatus: row.generationStatus,
    en: row.en
      ? {
          ...row.en,
          createdAt: row.en.createdAt.toISOString(),
        }
      : null,
    ar: row.ar
      ? {
          ...row.ar,
          createdAt: row.ar.createdAt.toISOString(),
        }
      : null,
  };
}

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

  findByReference(type: DocumentType, referenceId: string, language: string) {
    return this.prisma.document.findFirst({
      where: { type, referenceId, language },
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
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = input.taskId
          ? await this.findByTask(input.type, input.taskId, input.language)
          : await this.findByReference(input.type, input.referenceId, input.language);
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

  /** Paginated GRN / DN catalog: generated PDFs and pending slots on completed tasks. */
  async listCatalog(user: AuthPrincipal, query: ListContractsQueryDto) {
    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);

    const catalogParams = {
      companyId,
      search: query.search,
      type: query.type,
      referenceType: query.referenceType,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      language: query.language,
      pendingOnly: query.generationStatus === 'pending' ? true : undefined,
      generatedOnly: query.generationStatus === 'generated' ? true : undefined,
      completeOnly: query.generationStatus === 'complete' ? true : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    return withTenantRls(this.prisma, user, async (tx) => {
      const { rows, total } = await listContractCatalogSlots(tx, catalogParams);
      return {
        items: rows.map(serializeCatalogRow),
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
