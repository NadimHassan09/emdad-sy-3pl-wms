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
var GrnPdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrnPdfService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const branding_1 = require("./branding");
const document_storage_service_1 = require("./document-storage.service");
const document_slot_overrides_service_1 = require("./document-slot-overrides.service");
const documents_service_1 = require("./documents.service");
const i18n_1 = require("./i18n");
const barcode_util_1 = require("./barcode.util");
const pdf_context_util_1 = require("./pdf-context.util");
const pdf_table_util_1 = require("./pdf-table.util");
const pdf_service_1 = require("./pdf.service");
let GrnPdfService = GrnPdfService_1 = class GrnPdfService {
    prisma;
    pdf;
    storage;
    documents;
    slotOverrides;
    logger = new common_1.Logger(GrnPdfService_1.name);
    branding;
    constructor(prisma, pdf, storage, documents, slotOverrides, config) {
        this.prisma = prisma;
        this.pdf = pdf;
        this.storage = storage;
        this.documents = documents;
        this.slotOverrides = slotOverrides;
        this.branding = (0, branding_1.resolveBranding)(config);
    }
    async generateForReceivingTask(taskId, lang, opts) {
        const existing = await this.documents.findByTask(client_1.DocumentType.grn, taskId, lang);
        if (existing && !opts?.force)
            return this.toResult(existing);
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: { workflowInstance: true },
        });
        if (!task || task.taskType !== 'receiving') {
            this.logger.warn(`GRN skipped — receiving task ${taskId} not found.`);
            return null;
        }
        const inboundOrderId = task.workflowInstance.referenceId;
        const warehouseId = task.workflowInstance.warehouseId;
        const operatorId = task.completedById ?? null;
        const order = await this.prisma.inboundOrder.findUnique({
            where: { id: inboundOrderId },
            include: { company: true, lines: { include: { product: true } } },
        });
        if (!order) {
            this.logger.warn(`GRN skipped — inbound order ${inboundOrderId} not found.`);
            return null;
        }
        const [warehouse, operator, ledger] = await Promise.all([
            this.prisma.warehouse.findUnique({ where: { id: warehouseId } }),
            operatorId ? this.prisma.user.findUnique({ where: { id: operatorId } }) : Promise.resolve(null),
            this.prisma.inventoryLedger.findMany({
                where: {
                    referenceType: 'inbound_order',
                    referenceId: inboundOrderId,
                    movementType: 'inbound_receive',
                },
                select: { productId: true, lotId: true },
            }),
        ]);
        const lotIdByProduct = new Map();
        for (const row of ledger) {
            if (row.lotId && !lotIdByProduct.has(row.productId)) {
                lotIdByProduct.set(row.productId, row.lotId);
            }
        }
        const lotIds = [...new Set([...lotIdByProduct.values()])];
        const lots = lotIds.length
            ? await this.prisma.lot.findMany({ where: { id: { in: lotIds } } })
            : [];
        const lotById = new Map(lots.map((l) => [l.id, l]));
        const t = (0, i18n_1.makeTranslator)(lang);
        const L = (0, i18n_1.buildLabels)(lang);
        const receivedLines = order.lines.filter((l) => Number(l.receivedQuantity) > 0);
        const skuSet = new Set();
        let totalQty = 0;
        const items = receivedLines.map((line, idx) => {
            const product = line.product;
            const lotId = lotIdByProduct.get(line.productId);
            const lot = lotId ? lotById.get(lotId) : undefined;
            const batch = lot?.lotNumber ?? line.expectedLotNumber ?? '—';
            const expiry = lot?.expiryDate
                ? (0, i18n_1.formatDocDate)(lot.expiryDate, lang)
                : line.expectedExpiryDate
                    ? (0, i18n_1.formatDocDate)(line.expectedExpiryDate, lang)
                    : '—';
            const received = Number(line.receivedQuantity ?? 0);
            const expected = Number(line.expectedQuantity ?? 0);
            totalQty += received;
            skuSet.add(line.productId);
            const isShort = expected > 0 && received < expected;
            return {
                idx: idx + 1,
                sku: product?.sku ?? '—',
                name: product?.name ?? '—',
                batch,
                expiry,
                qty: (0, i18n_1.formatQty)(received, lang),
                unit: product?.uom ?? '',
                conditionLabel: isShort ? t('conditionShort') : t('conditionGood'),
                conditionClass: isShort ? 'cond--warn' : 'cond--ok',
            };
        });
        const generatedAt = new Date();
        const documentNumber = existing?.documentNumber ?? (await this.documents.nextNumber(client_1.DocumentType.grn));
        const operatorName = operator?.fullName ?? '—';
        const barcode = await (0, barcode_util_1.barcodePngDataUri)(documentNumber);
        const slot = (await this.slotOverrides.getEditable(taskId, client_1.DocumentType.grn)).fields;
        const context = {
            lang,
            dir: lang === 'ar' ? 'rtl' : 'ltr',
            L,
            brand: (0, pdf_context_util_1.brandContext)(this.branding, lang, this.pdf.logo),
            header: {
                titleMain: t('documentTitleGrn'),
                titleAbbr: t('grnAbbr'),
                referenceNo: documentNumber,
                issueDate: (0, i18n_1.formatDocDate)(generatedAt, lang),
                barcode,
            },
            party: {
                client: order.company?.name ?? '—',
                warehouse: warehouse?.name ?? warehouse?.code ?? '—',
                supplier: slot.supplier || '—',
                orderNumber: order.orderNumber || '—',
                reference: slot.clientReference || '—',
                date: (0, i18n_1.formatDocDate)(task.completedAt ?? generatedAt, lang),
                operator: slot.operatorName || operatorName,
                poNumber: slot.poNumber || '—',
            },
            items,
            emptyRows: (0, pdf_table_util_1.emptyTableRowSlots)(items.length),
            summary: {
                totalItems: items.length,
                totalQty: (0, i18n_1.formatQty)(totalQty, lang),
                totalSkus: skuSet.size,
                receivedBy: operatorName,
                receivingTime: (0, i18n_1.formatDocDateTime)(task.completedAt ?? generatedAt, lang),
            },
            notes: slot.notes,
            signatures: [
                { role: t('warehouseOfficer'), signature: L.signature, nameAndDate: L.nameAndDate },
                { role: t('supervisor'), signature: L.signature, nameAndDate: L.nameAndDate },
                { role: t('clientRepresentative'), signature: L.signature, nameAndDate: L.nameAndDate },
            ],
        };
        const buffer = await this.pdf.render('grn', context, (0, pdf_context_util_1.footerContext)(this.branding, lang, L));
        const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
        const stored = existing && opts?.force
            ? await this.storage.replace(client_1.DocumentType.grn, fileName, buffer)
            : await this.storage.write(client_1.DocumentType.grn, fileName, buffer);
        if (existing && opts?.force) {
            const doc = await this.documents.refreshFile(existing.id, stored);
            return this.toResult(doc);
        }
        const doc = await this.documents.create({
            companyId: order.companyId,
            type: client_1.DocumentType.grn,
            referenceType: 'inbound_order',
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
        return this.toResult(doc);
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
exports.GrnPdfService = GrnPdfService;
exports.GrnPdfService = GrnPdfService = GrnPdfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pdf_service_1.PdfService,
        document_storage_service_1.DocumentStorageService,
        documents_service_1.DocumentsService,
        document_slot_overrides_service_1.DocumentSlotOverridesService,
        config_1.ConfigService])
], GrnPdfService);
//# sourceMappingURL=grn-pdf.service.js.map