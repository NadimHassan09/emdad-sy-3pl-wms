"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfModule = void 0;
const common_1 = require("@nestjs/common");
const dn_pdf_service_1 = require("./dn-pdf.service");
const document_generation_service_1 = require("./document-generation.service");
const document_slot_overrides_service_1 = require("./document-slot-overrides.service");
const document_storage_service_1 = require("./document-storage.service");
const documents_controller_1 = require("./documents.controller");
const documents_service_1 = require("./documents.service");
const final_contract_pdf_service_1 = require("./final-contract-pdf.service");
const grn_pdf_service_1 = require("./grn-pdf.service");
const invoice_pdf_service_1 = require("./invoice-pdf.service");
const pdf_service_1 = require("./pdf.service");
let PdfModule = class PdfModule {
};
exports.PdfModule = PdfModule;
exports.PdfModule = PdfModule = __decorate([
    (0, common_1.Module)({
        controllers: [documents_controller_1.DocumentsController],
        providers: [
            pdf_service_1.PdfService,
            document_storage_service_1.DocumentStorageService,
            document_slot_overrides_service_1.DocumentSlotOverridesService,
            documents_service_1.DocumentsService,
            grn_pdf_service_1.GrnPdfService,
            dn_pdf_service_1.DnPdfService,
            final_contract_pdf_service_1.FinalContractPdfService,
            invoice_pdf_service_1.InvoicePdfService,
            document_generation_service_1.DocumentGenerationService,
        ],
        exports: [
            document_generation_service_1.DocumentGenerationService,
            grn_pdf_service_1.GrnPdfService,
            dn_pdf_service_1.DnPdfService,
            final_contract_pdf_service_1.FinalContractPdfService,
            invoice_pdf_service_1.InvoicePdfService,
            documents_service_1.DocumentsService,
        ],
    })
], PdfModule);
//# sourceMappingURL=pdf.module.js.map