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
exports.ApiDocsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const branding_1 = require("../../../pdf/branding");
const pdf_context_util_1 = require("../../../pdf/pdf-context.util");
const i18n_1 = require("../../../pdf/i18n");
const pdf_service_1 = require("../../../pdf/pdf.service");
const canonical_api_docs_1 = require("./canonical-api-docs");
const SCOPE_LABEL = {
    oms: 'OMS Orders API',
    inbound: 'Inbound Orders API',
    outbound: 'Outbound Orders API',
};
let ApiDocsService = class ApiDocsService {
    pdf;
    config;
    constructor(pdf, config) {
        this.pdf = pdf;
        this.config = config;
    }
    async render(scope) {
        const branding = (0, branding_1.resolveBranding)(this.config);
        const lang = 'en';
        const L = (0, i18n_1.buildLabels)(lang);
        const baseUrl = this.config.get('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ||
            'https://client.emdadsy.com/api/v1';
        const docs = (0, canonical_api_docs_1.canonicalApiDocs)(scope);
        return this.pdf.render('api_docs', {
            lang,
            dir: 'ltr',
            brand: (0, pdf_context_util_1.brandContext)(branding, lang, this.pdf.logo),
            header: {
                titleMain: docs.title,
                referenceNo: 'EMDAD API',
                issueDate: (0, i18n_1.formatDocDate)(new Date(), lang),
            },
            L,
            scope,
            scopeLabel: SCOPE_LABEL[scope],
            title: docs.title,
            summary: docs.summary,
            createPath: docs.createPath,
            createEndpoint: docs.createPath.replace(/^[A-Z]+\s+/, ''),
            getPath: docs.getPath,
            workflow: docs.workflow,
            bodyExample: docs.bodyExample,
            responseExample: docs.responseExample,
            fields: docs.fields,
            authAlternative: canonical_api_docs_1.AUTH_ALTERNATIVE,
            baseUrl,
            isOms: scope === 'oms',
            isInbound: scope === 'inbound',
            isOutbound: scope === 'outbound',
        }, (0, pdf_context_util_1.footerContext)(branding, lang, L));
    }
};
exports.ApiDocsService = ApiDocsService;
exports.ApiDocsService = ApiDocsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pdf_service_1.PdfService,
        config_1.ConfigService])
], ApiDocsService);
//# sourceMappingURL=api-docs.service.js.map