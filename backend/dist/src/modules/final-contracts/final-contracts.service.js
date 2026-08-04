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
exports.FinalContractsService = void 0;
const common_1 = require("@nestjs/common");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const realtime_service_1 = require("../realtime/realtime.service");
function generationStatus(en, ar) {
    if (en && ar)
        return 'complete';
    if (en || ar)
        return 'partial';
    return 'pending';
}
let FinalContractsService = class FinalContractsService {
    prisma;
    companyAccess;
    realtime;
    constructor(prisma, companyAccess, realtime) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.realtime = realtime;
    }
    async nextContractNumber() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT nextval('final_contract_document_seq')::int AS n`);
        const n = rows[0]?.n ?? 1;
        const year = new Date().getFullYear();
        return `SWC-${year}-${String(n).padStart(5, '0')}`;
    }
    async create(user, dto) {
        this.companyAccess.assertCompanyAccess(user, dto.companyId);
        const contractNumber = await this.nextContractNumber();
        const row = await this.prisma.finalContract.create({
            data: {
                companyId: dto.companyId,
                contractNumber,
                issueDate: new Date(`${dto.issueDate}T00:00:00.000Z`),
                clientCompanyName: dto.clientCompanyName.trim(),
                clientCompanyType: dto.clientCompanyType?.trim() || null,
                clientAddress: dto.clientAddress?.trim() || null,
                clientPhone: dto.clientPhone?.trim() || null,
                clientEmail: dto.clientEmail?.trim() || null,
                clientTaxId: dto.clientTaxId?.trim() || null,
                clientSignatoryName: dto.clientSignatoryName?.trim() || null,
                clientSignatoryTitle: dto.clientSignatoryTitle?.trim() || null,
                rateStorage: dto.rateStorage,
                rateInboundHandling: dto.rateInboundHandling,
                rateOutboundHandling: dto.rateOutboundHandling,
                rateValueAddedServices: dto.rateValueAddedServices,
                rateReturnProcessing: dto.rateReturnProcessing,
                createdBy: user.id ?? null,
            },
            include: { company: { select: { id: true, name: true } } },
        });
        this.realtime.emitFinalContractChanged(row.companyId, {
            contractId: row.id,
            companyId: row.companyId,
            action: 'created',
        });
        return this.serializeRow(row, null, null);
    }
    async list(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const where = {};
            if (companyId)
                where.companyId = companyId;
            if (query.search?.trim()) {
                const t = query.search.trim();
                where.OR = [
                    { contractNumber: { contains: t, mode: 'insensitive' } },
                    { clientCompanyName: { contains: t, mode: 'insensitive' } },
                    { company: { name: { contains: t, mode: 'insensitive' } } },
                ];
            }
            if (query.issueFrom) {
                where.issueDate = { ...where.issueDate, gte: new Date(`${query.issueFrom}T00:00:00.000Z`) };
            }
            if (query.issueTo) {
                where.issueDate = { ...where.issueDate, lte: new Date(`${query.issueTo}T23:59:59.999Z`) };
            }
            const rows = await tx.finalContract.findMany({
                where,
                orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
                include: { company: { select: { id: true, name: true } } },
                take: query.limit,
                skip: query.offset,
            });
            const ids = rows.map((r) => r.id);
            const docs = ids.length
                ? await tx.document.findMany({
                    where: { referenceType: 'final_contract', referenceId: { in: ids } },
                })
                : [];
            const docsByRef = new Map();
            for (const d of docs) {
                const list = docsByRef.get(d.referenceId) ?? [];
                list.push(d);
                docsByRef.set(d.referenceId, list);
            }
            let items = rows.map((row) => {
                const related = docsByRef.get(row.id) ?? [];
                const enDoc = related.find((d) => d.language === 'en') ?? null;
                const arDoc = related.find((d) => d.language === 'ar') ?? null;
                return this.serializeRow(row, enDoc, arDoc);
            });
            if (query.generationStatus) {
                items = items.filter((item) => {
                    if (query.generationStatus === 'pending') {
                        return item.generationStatus === 'pending' || item.generationStatus === 'partial';
                    }
                    if (query.generationStatus === 'generated') {
                        return item.generationStatus !== 'pending';
                    }
                    return item.generationStatus === 'complete';
                });
            }
            const total = query.generationStatus
                ? items.length
                : await tx.finalContract.count({ where });
            return {
                items,
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async findById(user, id) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilter)(this.companyAccess, user);
        const row = await this.prisma.finalContract.findFirst({
            where: { id, ...(companyId ? { companyId } : {}) },
            include: { company: { select: { id: true, name: true } } },
        });
        if (!row)
            throw new common_1.NotFoundException('Final contract not found.');
        const docs = await this.prisma.document.findMany({
            where: { referenceType: 'final_contract', referenceId: id },
        });
        const enDoc = docs.find((d) => d.language === 'en') ?? null;
        const arDoc = docs.find((d) => d.language === 'ar') ?? null;
        return this.serializeRow(row, enDoc, arDoc);
    }
    async update(user, id, dto) {
        const existing = await this.findById(user, id);
        if (dto.companyId) {
            this.companyAccess.assertCompanyAccess(user, dto.companyId);
        }
        const row = await this.prisma.finalContract.update({
            where: { id: existing.id },
            data: {
                ...(dto.companyId ? { companyId: dto.companyId } : {}),
                ...(dto.issueDate ? { issueDate: new Date(`${dto.issueDate}T00:00:00.000Z`) } : {}),
                ...(dto.clientCompanyName !== undefined
                    ? { clientCompanyName: dto.clientCompanyName.trim() }
                    : {}),
                ...(dto.clientCompanyType !== undefined
                    ? { clientCompanyType: dto.clientCompanyType?.trim() || null }
                    : {}),
                ...(dto.clientAddress !== undefined
                    ? { clientAddress: dto.clientAddress?.trim() || null }
                    : {}),
                ...(dto.clientPhone !== undefined ? { clientPhone: dto.clientPhone?.trim() || null } : {}),
                ...(dto.clientEmail !== undefined ? { clientEmail: dto.clientEmail?.trim() || null } : {}),
                ...(dto.clientTaxId !== undefined ? { clientTaxId: dto.clientTaxId?.trim() || null } : {}),
                ...(dto.clientSignatoryName !== undefined
                    ? { clientSignatoryName: dto.clientSignatoryName?.trim() || null }
                    : {}),
                ...(dto.clientSignatoryTitle !== undefined
                    ? { clientSignatoryTitle: dto.clientSignatoryTitle?.trim() || null }
                    : {}),
                ...(dto.rateStorage !== undefined ? { rateStorage: dto.rateStorage } : {}),
                ...(dto.rateInboundHandling !== undefined
                    ? { rateInboundHandling: dto.rateInboundHandling }
                    : {}),
                ...(dto.rateOutboundHandling !== undefined
                    ? { rateOutboundHandling: dto.rateOutboundHandling }
                    : {}),
                ...(dto.rateValueAddedServices !== undefined
                    ? { rateValueAddedServices: dto.rateValueAddedServices }
                    : {}),
                ...(dto.rateReturnProcessing !== undefined
                    ? { rateReturnProcessing: dto.rateReturnProcessing }
                    : {}),
            },
            include: { company: { select: { id: true, name: true } } },
        });
        this.realtime.emitFinalContractChanged(row.companyId, {
            contractId: row.id,
            companyId: row.companyId,
            action: 'updated',
        });
        const docs = await this.prisma.document.findMany({
            where: { referenceType: 'final_contract', referenceId: id },
        });
        const enDoc = docs.find((d) => d.language === 'en') ?? null;
        const arDoc = docs.find((d) => d.language === 'ar') ?? null;
        return this.serializeRow(row, enDoc, arDoc);
    }
    serializeRow(row, enDoc, arDoc) {
        const en = enDoc
            ? {
                documentId: enDoc.id,
                documentNumber: enDoc.documentNumber,
                fileSize: enDoc.fileSize,
                createdAt: enDoc.createdAt,
                pdfUrl: `/api/documents/${enDoc.id}/file`,
            }
            : null;
        const ar = arDoc
            ? {
                documentId: arDoc.id,
                documentNumber: arDoc.documentNumber,
                fileSize: arDoc.fileSize,
                createdAt: arDoc.createdAt,
                pdfUrl: `/api/documents/${arDoc.id}/file`,
            }
            : null;
        return {
            id: row.id,
            contractNumber: row.contractNumber,
            issueDate: row.issueDate.toISOString().slice(0, 10),
            companyId: row.companyId,
            company: row.company,
            clientCompanyName: row.clientCompanyName,
            clientCompanyType: row.clientCompanyType,
            clientAddress: row.clientAddress,
            clientPhone: row.clientPhone,
            clientEmail: row.clientEmail,
            clientTaxId: row.clientTaxId,
            clientSignatoryName: row.clientSignatoryName,
            clientSignatoryTitle: row.clientSignatoryTitle,
            rateStorage: Number(row.rateStorage),
            rateInboundHandling: Number(row.rateInboundHandling),
            rateOutboundHandling: Number(row.rateOutboundHandling),
            rateValueAddedServices: Number(row.rateValueAddedServices),
            rateReturnProcessing: Number(row.rateReturnProcessing),
            createdAt: row.createdAt.toISOString(),
            generationStatus: generationStatus(en, ar),
            en: en
                ? { ...en, createdAt: en.createdAt.toISOString() }
                : null,
            ar: ar
                ? { ...ar, createdAt: ar.createdAt.toISOString() }
                : null,
        };
    }
};
exports.FinalContractsService = FinalContractsService;
exports.FinalContractsService = FinalContractsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        realtime_service_1.RealtimeService])
], FinalContractsService);
//# sourceMappingURL=final-contracts.service.js.map