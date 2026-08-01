"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../common/auth/company-read-scope");
const company_access_service_1 = require("../common/company-access/company-access.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_rls_1 = require("../common/prisma/tenant-rls");
const contracts_catalog_query_1 = require("./contracts-catalog.query");
const SEQ = {
    [client_1.DocumentType.grn]: { seq: 'grn_document_seq', prefix: 'GRN' },
    [client_1.DocumentType.delivery_note]: { seq: 'dn_document_seq', prefix: 'DN' },
    [client_1.DocumentType.final_contract]: { seq: 'final_contract_document_seq', prefix: 'SWC' },
};
function serializeCatalogRow(row) {
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
let DocumentsService = class DocumentsService {
    prisma;
    companyAccess;
    constructor(prisma, companyAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    async nextNumber(type) {
        const { seq, prefix } = SEQ[type];
        const rows = await this.prisma.$queryRawUnsafe(`SELECT nextval('${seq}')::int AS n`);
        const n = rows[0]?.n ?? 1;
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
    }
    findByTask(type, taskId, language) {
        return this.prisma.document.findFirst({
            where: { type, taskId, language },
        });
    }
    findByReference(type, referenceId, language) {
        return this.prisma.document.findFirst({
            where: { type, referenceId, language },
        });
    }
    async refreshFile(id, stored) {
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
    async create(input) {
        try {
            return await this.prisma.document.create({ data: input });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const existing = input.taskId
                    ? await this.findByTask(input.type, input.taskId, input.language)
                    : await this.findByReference(input.type, input.referenceId, input.language);
                if (existing)
                    return existing;
            }
            throw err;
        }
    }
    async listForReference(user, referenceType, referenceId) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilter)(this.companyAccess, user);
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
    async listCatalog(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
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
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const { rows, total } = await (0, contracts_catalog_query_1.listContractCatalogSlots)(tx, catalogParams);
            return {
                items: rows.map(serializeCatalogRow),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async getForDownload(user, id) {
        const doc = await this.prisma.document.findUnique({ where: { id } });
        if (!doc)
            throw new common_1.NotFoundException('Document not found.');
        this.companyAccess.validateResourceOwnership(user, doc);
        return doc;
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map