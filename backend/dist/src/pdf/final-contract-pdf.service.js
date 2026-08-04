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
var FinalContractPdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalContractPdfService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const realtime_service_1 = require("../modules/realtime/realtime.service");
const branding_1 = require("./branding");
const document_storage_service_1 = require("./document-storage.service");
const documents_service_1 = require("./documents.service");
const final_contract_i18n_1 = require("./final-contract-i18n");
const barcode_util_1 = require("./barcode.util");
const i18n_1 = require("./i18n");
const pdf_context_util_1 = require("./pdf-context.util");
const pdf_service_1 = require("./pdf.service");
let FinalContractPdfService = FinalContractPdfService_1 = class FinalContractPdfService {
    prisma;
    pdf;
    storage;
    documents;
    realtime;
    logger = new common_1.Logger(FinalContractPdfService_1.name);
    branding;
    constructor(prisma, pdf, storage, documents, realtime, config) {
        this.prisma = prisma;
        this.pdf = pdf;
        this.storage = storage;
        this.documents = documents;
        this.realtime = realtime;
        this.branding = (0, branding_1.resolveBranding)(config);
    }
    async generateForContract(contractId, lang, opts, generatedBy) {
        const existing = await this.documents.findByReference(client_1.DocumentType.final_contract, contractId, lang);
        if (existing && !opts?.force)
            return this.toResult(existing);
        const contract = await this.prisma.finalContract.findUnique({
            where: { id: contractId },
            include: { company: true },
        });
        if (!contract) {
            this.logger.warn(`Final contract PDF skipped — contract ${contractId} not found.`);
            return null;
        }
        const L = (0, final_contract_i18n_1.fcLabels)(lang);
        const footerLabels = (0, i18n_1.buildLabels)(lang);
        const generatedAt = new Date();
        const documentNumber = existing?.documentNumber ?? contract.contractNumber;
        const barcode = await (0, barcode_util_1.barcodePngDataUri)(documentNumber);
        const rates = {
            rateStorage: Number(contract.rateStorage),
            rateInboundHandling: Number(contract.rateInboundHandling),
            rateOutboundHandling: Number(contract.rateOutboundHandling),
            rateValueAddedServices: Number(contract.rateValueAddedServices),
            rateReturnProcessing: Number(contract.rateReturnProcessing),
        };
        const pricingRows = final_contract_i18n_1.FC_PRICING_ROWS.map((row) => ({
            service: (0, final_contract_i18n_1.fcMsg)(row.service, lang),
            description: (0, final_contract_i18n_1.fcMsg)(row.description, lang),
            unit: (0, final_contract_i18n_1.fcMsg)(row.unit, lang),
            billing: (0, final_contract_i18n_1.fcMsg)(row.billing, lang),
            rate: (0, final_contract_i18n_1.formatUsd)(rates[row.rateKey], lang),
        }));
        const issueDateFormatted = (0, i18n_1.formatDocDate)(contract.issueDate, lang);
        const context = {
            lang,
            dir: lang === 'ar' ? 'rtl' : 'ltr',
            L,
            brand: (0, pdf_context_util_1.brandContext)(this.branding, lang, this.pdf.logo),
            header: {
                titleMain: L.documentTitle,
                titleAbbr: (0, final_contract_i18n_1.fcMsg)(final_contract_i18n_1.FC_LABELS.contractNo, lang),
                referenceNo: `${L.contractNo}: ${contract.contractNumber}`,
                issueDate: issueDateFormatted,
                barcode,
            },
            provider: {
                name: lang === 'ar' ? this.branding.companyNameAr : this.branding.companyName,
                type: L.providerCompanyType,
                address: lang === 'ar' ? this.branding.addressAr : this.branding.addressEn,
                phone: this.branding.phone,
                email: this.branding.email,
                taxId: '—',
                signatoryName: lang === 'ar' ? 'مدير العمليات' : 'Operations Director',
                signatoryTitle: lang === 'ar' ? 'مقدم الخدمة' : 'Service Provider',
            },
            client: {
                name: contract.clientCompanyName,
                type: contract.clientCompanyType || '—',
                address: contract.clientAddress || '—',
                phone: contract.clientPhone || '—',
                email: contract.clientEmail || '—',
                taxId: contract.clientTaxId || '—',
                signatoryName: contract.clientSignatoryName || '—',
                signatoryTitle: contract.clientSignatoryTitle || '—',
            },
            scopeServices: final_contract_i18n_1.FC_SCOPE_SERVICES.map((item, idx) => ({
                idx: idx + 1,
                label: (0, final_contract_i18n_1.fcMsg)(item, lang),
            })),
            pricingRows,
            providerObligations: (0, final_contract_i18n_1.fcBullets)(final_contract_i18n_1.FC_PROVIDER_OBLIGATIONS, lang),
            clientObligations: (0, final_contract_i18n_1.fcBullets)(final_contract_i18n_1.FC_CLIENT_OBLIGATIONS, lang),
            termBullets: (0, final_contract_i18n_1.fcBullets)(final_contract_i18n_1.FC_TERM_BULLETS, lang),
            liabilityBullets: (0, final_contract_i18n_1.fcBullets)(final_contract_i18n_1.FC_LIABILITY_BULLETS, lang),
            generalBullets: (0, final_contract_i18n_1.fcBullets)(final_contract_i18n_1.FC_GENERAL_BULLETS, lang),
        };
        const buffer = await this.pdf.render('final_contract', context, (0, pdf_context_util_1.footerContext)(this.branding, lang, footerLabels));
        const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
        const stored = existing && opts?.force
            ? await this.storage.replace(client_1.DocumentType.final_contract, fileName, buffer)
            : await this.storage.write(client_1.DocumentType.final_contract, fileName, buffer);
        if (existing && opts?.force) {
            const doc = await this.documents.refreshFile(existing.id, stored);
            const result = this.toResult(doc);
            this.realtime.emitDocumentGenerated(contract.companyId, {
                documentId: result.id,
                type: client_1.DocumentType.final_contract,
                referenceType: 'final_contract',
                referenceId: contract.id,
                taskId: null,
                documentNumber: result.documentNumber,
                language: result.language,
                pdfUrl: result.pdfUrl,
            });
            return result;
        }
        const doc = await this.documents.create({
            companyId: contract.companyId,
            type: client_1.DocumentType.final_contract,
            referenceType: 'final_contract',
            referenceId: contract.id,
            taskId: null,
            documentNumber,
            fileName: stored.fileName,
            filePath: stored.filePath,
            language: lang,
            hash: stored.hash,
            fileSize: stored.fileSize,
            generatedBy: generatedBy ?? null,
        });
        const result = this.toResult(doc);
        this.realtime.emitDocumentGenerated(contract.companyId, {
            documentId: result.id,
            type: client_1.DocumentType.final_contract,
            referenceType: 'final_contract',
            referenceId: contract.id,
            taskId: null,
            documentNumber: result.documentNumber,
            language: result.language,
            pdfUrl: result.pdfUrl,
        });
        return result;
    }
    toResult(doc) {
        return {
            id: doc.id,
            documentNumber: doc.documentNumber,
            pdfUrl: `/api/documents/${doc.id}/file`,
            pdfPath: doc.filePath,
            generatedAt: doc.createdAt,
            language: doc.language,
        };
    }
};
exports.FinalContractPdfService = FinalContractPdfService;
exports.FinalContractPdfService = FinalContractPdfService = FinalContractPdfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pdf_service_1.PdfService,
        document_storage_service_1.DocumentStorageService,
        documents_service_1.DocumentsService,
        realtime_service_1.RealtimeService,
        config_1.ConfigService])
], FinalContractPdfService);
//# sourceMappingURL=final-contract-pdf.service.js.map