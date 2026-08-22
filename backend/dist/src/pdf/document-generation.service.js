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
var DocumentGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentGenerationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dn_pdf_service_1 = require("./dn-pdf.service");
const grn_pdf_service_1 = require("./grn-pdf.service");
const i18n_1 = require("./i18n");
let DocumentGenerationService = DocumentGenerationService_1 = class DocumentGenerationService {
    grn;
    dn;
    logger = new common_1.Logger(DocumentGenerationService_1.name);
    defaultLang;
    constructor(grn, dn, config) {
        this.grn = grn;
        this.dn = dn;
        this.defaultLang = (0, i18n_1.normalizeLang)(config.get('DOCUMENT_DEFAULT_LANG') ?? 'en');
    }
    async generateGrnForReceiving(taskId, lang) {
        try {
            await this.grn.generateForReceivingTask(taskId, lang ?? this.defaultLang);
        }
        catch (err) {
            this.logger.error(`Failed to auto-generate GRN for receiving task ${taskId}: ${String(err)}`);
        }
    }
    async generateDnForDispatch(taskId, lang) {
        try {
            await this.dn.generateForDispatchTask(taskId, lang ?? this.defaultLang);
        }
        catch (err) {
            this.logger.error(`Failed to auto-generate Delivery Note for dispatch task ${taskId}: ${String(err)}`);
        }
    }
    defaultLanguage() {
        return this.defaultLang;
    }
};
exports.DocumentGenerationService = DocumentGenerationService;
exports.DocumentGenerationService = DocumentGenerationService = DocumentGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [grn_pdf_service_1.GrnPdfService,
        dn_pdf_service_1.DnPdfService,
        config_1.ConfigService])
], DocumentGenerationService);
//# sourceMappingURL=document-generation.service.js.map