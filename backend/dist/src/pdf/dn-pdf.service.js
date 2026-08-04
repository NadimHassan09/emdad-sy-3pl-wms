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
var DnPdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DnPdfService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const realtime_service_1 = require("../modules/realtime/realtime.service");
const branding_1 = require("./branding");
const document_storage_service_1 = require("./document-storage.service");
const document_slot_overrides_service_1 = require("./document-slot-overrides.service");
const documents_service_1 = require("./documents.service");
const i18n_1 = require("./i18n");
const barcode_util_1 = require("./barcode.util");
const pdf_context_util_1 = require("./pdf-context.util");
const pdf_table_util_1 = require("./pdf-table.util");
const pdf_service_1 = require("./pdf.service");
let DnPdfService = DnPdfService_1 = class DnPdfService {
    prisma;
    pdf;
    storage;
    documents;
    slotOverrides;
    realtime;
    logger = new common_1.Logger(DnPdfService_1.name);
    branding;
    constructor(prisma, pdf, storage, documents, slotOverrides, realtime, config) {
        this.prisma = prisma;
        this.pdf = pdf;
        this.storage = storage;
        this.documents = documents;
        this.slotOverrides = slotOverrides;
        this.realtime = realtime;
        this.branding = (0, branding_1.resolveBranding)(config);
    }
    async generateForDispatchTask(taskId, lang, opts) {
        const existing = await this.documents.findByTask(client_1.DocumentType.delivery_note, taskId, lang);
        if (existing && !opts?.force)
            return this.toResult(existing);
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: { workflowInstance: true },
        });
        if (!task || task.taskType !== 'dispatch') {
            this.logger.warn(`DN skipped — dispatch task ${taskId} not found.`);
            return null;
        }
        const outboundOrderId = task.workflowInstance.referenceId;
        const warehouseId = task.workflowInstance.warehouseId;
        const operatorId = task.completedById ?? null;
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            include: { company: true, lines: { include: { product: true } } },
        });
        if (!order) {
            this.logger.warn(`DN skipped — outbound order ${outboundOrderId} not found.`);
            return null;
        }
        const [warehouse, operator] = await Promise.all([
            this.prisma.warehouse.findUnique({ where: { id: warehouseId } }),
            operatorId ? this.prisma.user.findUnique({ where: { id: operatorId } }) : Promise.resolve(null),
        ]);
        const t = (0, i18n_1.makeTranslator)(lang);
        const L = (0, i18n_1.buildLabels)(lang);
        const skuSet = new Set();
        let totalQty = 0;
        const items = order.lines.map((line, idx) => {
            const ordered = Number(line.requestedQuantity ?? 0);
            const picked = Number(line.pickedQuantity ?? 0);
            const shipped = picked;
            totalQty += shipped;
            if (line.productId)
                skuSet.add(line.productId);
            return {
                idx: idx + 1,
                sku: line.product?.sku ?? '—',
                name: line.product?.name ?? '—',
                orderedQty: (0, i18n_1.formatQty)(ordered, lang),
                pickedQty: (0, i18n_1.formatQty)(picked, lang),
                shippedQty: (0, i18n_1.formatQty)(shipped, lang),
                unit: line.product?.uom ?? '',
            };
        });
        const generatedAt = new Date();
        const documentNumber = existing?.documentNumber ?? (await this.documents.nextNumber(client_1.DocumentType.delivery_note));
        const operatorName = operator?.fullName ?? '—';
        const carrier = (order.carrier ?? '').trim() || '—';
        const tracking = (order.trackingNumber ?? '').trim() || '—';
        const barcode = await (0, barcode_util_1.barcodePngDataUri)(documentNumber);
        const slot = (await this.slotOverrides.getEditable(taskId, client_1.DocumentType.delivery_note)).fields;
        const context = {
            lang,
            dir: lang === 'ar' ? 'rtl' : 'ltr',
            L,
            brand: (0, pdf_context_util_1.brandContext)(this.branding, lang, this.pdf.logo),
            header: {
                titleMain: t('documentTitleDn'),
                titleAbbr: t('dnAbbr'),
                referenceNo: documentNumber,
                issueDate: (0, i18n_1.formatDocDate)(generatedAt, lang),
                barcode,
            },
            party: {
                customer: order.company?.name ?? '—',
                destination: slot.destination || order.destinationAddress || '—',
                warehouse: warehouse?.name ?? warehouse?.code ?? '—',
                orderNumber: order.orderNumber || '—',
                reference: slot.clientReference || '—',
                date: (0, i18n_1.formatDocDate)(order.shippedAt ?? task.completedAt ?? generatedAt, lang),
                carrier: slot.carrier || carrier,
                tracking: slot.trackingNumber || tracking,
                vehicle: slot.vehicle || '—',
                driver: slot.driver || '—',
            },
            items,
            emptyRows: (0, pdf_table_util_1.emptyTableRowSlots)(items.length),
            summary: {
                totalItems: items.length,
                totalQty: (0, i18n_1.formatQty)(totalQty, lang),
                totalSkus: skuSet.size,
                preparedBy: operatorName,
                releasedBy: operatorName,
                dispatchTime: (0, i18n_1.formatDocDateTime)(order.shippedAt ?? task.completedAt ?? generatedAt, lang),
            },
            notes: slot.notes,
            signatures: [
                { role: t('warehouseSign'), signature: L.signature, nameAndDate: L.nameAndDate },
                { role: t('driverSign'), signature: L.signature, nameAndDate: L.nameAndDate },
                { role: t('customerSign'), signature: L.signature, nameAndDate: L.nameAndDate },
            ],
        };
        const buffer = await this.pdf.render('dn', context, (0, pdf_context_util_1.footerContext)(this.branding, lang, L));
        const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
        const stored = existing && opts?.force
            ? await this.storage.replace(client_1.DocumentType.delivery_note, fileName, buffer)
            : await this.storage.write(client_1.DocumentType.delivery_note, fileName, buffer);
        if (existing && opts?.force) {
            const doc = await this.documents.refreshFile(existing.id, stored);
            const result = this.toResult(doc);
            this.realtime.emitDocumentGenerated(order.companyId, {
                documentId: result.id,
                type: client_1.DocumentType.delivery_note,
                referenceType: 'outbound_order',
                referenceId: order.id,
                taskId,
                documentNumber: result.documentNumber,
                language: result.language,
                pdfUrl: result.pdfUrl,
            });
            return result;
        }
        const doc = await this.documents.create({
            companyId: order.companyId,
            type: client_1.DocumentType.delivery_note,
            referenceType: 'outbound_order',
            referenceId: order.id,
            taskId,
            documentNumber,
            fileName: stored.fileName,
            filePath: stored.filePath,
            language: lang,
            hash: stored.hash,
            fileSize: stored.fileSize,
            generatedBy: operatorId,
        });
        const result = this.toResult(doc);
        this.realtime.emitDocumentGenerated(order.companyId, {
            documentId: result.id,
            type: client_1.DocumentType.delivery_note,
            referenceType: 'outbound_order',
            referenceId: order.id,
            taskId,
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
exports.DnPdfService = DnPdfService;
exports.DnPdfService = DnPdfService = DnPdfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pdf_service_1.PdfService,
        document_storage_service_1.DocumentStorageService,
        documents_service_1.DocumentsService,
        document_slot_overrides_service_1.DocumentSlotOverridesService,
        realtime_service_1.RealtimeService,
        config_1.ConfigService])
], DnPdfService);
//# sourceMappingURL=dn-pdf.service.js.map