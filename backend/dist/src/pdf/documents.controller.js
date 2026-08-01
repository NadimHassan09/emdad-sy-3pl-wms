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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsController = void 0;
const promises_1 = require("node:fs/promises");
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../common/auth/current-user.decorator");
const company_access_service_1 = require("../common/company-access/company-access.service");
const parse_uuid_loose_pipe_1 = require("../common/pipes/parse-uuid-loose.pipe");
const prisma_service_1 = require("../common/prisma/prisma.service");
const dn_pdf_service_1 = require("./dn-pdf.service");
const final_contract_pdf_service_1 = require("./final-contract-pdf.service");
const document_slot_overrides_service_1 = require("./document-slot-overrides.service");
const documents_service_1 = require("./documents.service");
const document_slot_dto_1 = require("./dto/document-slot.dto");
const grn_pdf_service_1 = require("./grn-pdf.service");
const list_documents_query_dto_1 = require("./dto/list-documents-query.dto");
const list_contracts_query_dto_1 = require("./dto/list-contracts-query.dto");
const i18n_1 = require("./i18n");
let DocumentsController = class DocumentsController {
    documents;
    grn;
    dn;
    finalContract;
    slotOverrides;
    prisma;
    companyAccess;
    constructor(documents, grn, dn, finalContract, slotOverrides, prisma, companyAccess) {
        this.documents = documents;
        this.grn = grn;
        this.dn = dn;
        this.finalContract = finalContract;
        this.slotOverrides = slotOverrides;
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    listCatalog(user, query) {
        return this.documents.listCatalog(user, query);
    }
    list(user, query) {
        return this.documents.listForReference(user, query.referenceType, query.referenceId);
    }
    async getSlot(user, taskId, query) {
        await this.assertTaskTenant(user, taskId);
        return this.slotOverrides.getEditable(taskId, query.type);
    }
    async updateSlot(user, taskId, dto) {
        await this.assertTaskTenant(user, taskId);
        return this.slotOverrides.upsert(taskId, dto);
    }
    async file(user, id, res) {
        const doc = await this.documents.getForDownload(user, id);
        const buffer = await (0, promises_1.readFile)(doc.filePath).catch(() => null);
        if (!buffer) {
            throw new common_1.NotFoundException('Document file is no longer available on disk.');
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
        res.setHeader('Content-Length', buffer.byteLength.toString());
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.end(buffer);
    }
    async generateGrn(user, taskId, lang) {
        await this.assertTaskTenant(user, taskId);
        return this.grn.generateForReceivingTask(taskId, (0, i18n_1.normalizeLang)(lang), { force: true });
    }
    async generateDn(user, taskId, lang) {
        await this.assertTaskTenant(user, taskId);
        return this.dn.generateForDispatchTask(taskId, (0, i18n_1.normalizeLang)(lang), { force: true });
    }
    async generateFinalContract(user, contractId, lang) {
        await this.assertFinalContractTenant(user, contractId);
        return this.finalContract.generateForContract(contractId, (0, i18n_1.normalizeLang)(lang), { force: true }, user.id ?? null);
    }
    async assertFinalContractTenant(user, contractId) {
        const row = await this.prisma.finalContract.findUnique({
            where: { id: contractId },
            select: { companyId: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Final contract not found.');
        this.companyAccess.assertCompanyAccess(user, row.companyId);
    }
    async assertTaskTenant(user, taskId) {
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: { workflowInstance: { select: { companyId: true } } },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found.');
        this.companyAccess.assertCompanyAccess(user, task.workflowInstance.companyId);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Get)('catalog'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_contracts_query_dto_1.ListContractsQueryDto]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "listCatalog", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_documents_query_dto_1.ListDocumentsQueryDto]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('slot/:taskId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('taskId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, document_slot_dto_1.GetDocumentSlotQueryDto]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "getSlot", null);
__decorate([
    (0, common_1.Patch)('slot/:taskId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('taskId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, document_slot_dto_1.UpdateDocumentSlotDto]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "updateSlot", null);
__decorate([
    (0, common_1.Get)(':id/file'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "file", null);
__decorate([
    (0, common_1.Post)('grn/:taskId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('taskId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "generateGrn", null);
__decorate([
    (0, common_1.Post)('dn/:taskId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('taskId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "generateDn", null);
__decorate([
    (0, common_1.Post)('final-contract/:contractId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('contractId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)('lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "generateFinalContract", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.Controller)('documents'),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService,
        grn_pdf_service_1.GrnPdfService,
        dn_pdf_service_1.DnPdfService,
        final_contract_pdf_service_1.FinalContractPdfService,
        document_slot_overrides_service_1.DocumentSlotOverridesService,
        prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map