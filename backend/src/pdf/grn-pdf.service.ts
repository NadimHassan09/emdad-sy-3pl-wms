import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../modules/realtime/realtime.service';
import { DocumentBranding, resolveBranding } from './branding';
import { DocumentStorageService } from './document-storage.service';
import { DocumentSlotOverridesService } from './document-slot-overrides.service';
import { DocumentsService } from './documents.service';
import {
  DocLang,
  buildLabels,
  formatDocDate,
  formatDocDateTime,
  formatQty,
  makeTranslator,
} from './i18n';
import { barcodePngDataUri } from './barcode.util';
import { brandContext, footerContext } from './pdf-context.util';
import { emptyTableRowSlots } from './pdf-table.util';
import { PdfService } from './pdf.service';

export interface GenerateDocumentOptions {
  /** When true, re-render and replace an existing PDF (explicit user action). */
  force?: boolean;
}

export interface GeneratedDocumentResult {
  id: string;
  documentNumber: string;
  pdfUrl: string;
  pdfPath: string;
  generatedAt: Date;
  language: string;
}

@Injectable()
export class GrnPdfService {
  private readonly logger = new Logger(GrnPdfService.name);
  private readonly branding: DocumentBranding;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: DocumentStorageService,
    private readonly documents: DocumentsService,
    private readonly slotOverrides: DocumentSlotOverridesService,
    private readonly realtime: RealtimeService,
    config: ConfigService,
  ) {
    this.branding = resolveBranding(config);
  }

  /**
   * Build the immutable GRN for a completed receiving task. Reconstructs the
   * receipt from persisted state (order lines + inbound ledger) so the same
   * method backs both auto-generation and on-demand language variants.
   */
  async generateForReceivingTask(
    taskId: string,
    lang: DocLang,
    opts?: GenerateDocumentOptions,
  ): Promise<GeneratedDocumentResult | null> {
    const existing = await this.documents.findByTask(DocumentType.grn, taskId, lang);
    if (existing && !opts?.force) return this.toResult(existing);

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

    const lotIdByProduct = new Map<string, string>();
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

    const t = makeTranslator(lang);
    const L = buildLabels(lang);

    const receivedLines = order.lines.filter((l) => Number(l.receivedQuantity) > 0);
    const skuSet = new Set<string>();
    let totalQty = 0;

    const items = receivedLines.map((line, idx) => {
      const product = line.product;
      const lotId = lotIdByProduct.get(line.productId);
      const lot = lotId ? lotById.get(lotId) : undefined;
      const batch = lot?.lotNumber ?? line.expectedLotNumber ?? '—';
      const expiry = lot?.expiryDate
        ? formatDocDate(lot.expiryDate, lang)
        : line.expectedExpiryDate
          ? formatDocDate(line.expectedExpiryDate, lang)
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
        qty: formatQty(received, lang),
        unit: product?.uom ?? '',
        conditionLabel: isShort ? t('conditionShort') : t('conditionGood'),
        conditionClass: isShort ? 'cond--warn' : 'cond--ok',
      };
    });

    const generatedAt = new Date();
    const documentNumber =
      existing?.documentNumber ?? (await this.documents.nextNumber(DocumentType.grn));
    const operatorName = operator?.fullName ?? '—';
    const barcode = await barcodePngDataUri(documentNumber);
    const slot = (await this.slotOverrides.getEditable(taskId, DocumentType.grn)).fields;

    const context = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      L,
      brand: brandContext(this.branding, lang, this.pdf.logo),
      header: {
        titleMain: t('documentTitleGrn'),
        titleAbbr: t('grnAbbr'),
        referenceNo: documentNumber,
        issueDate: formatDocDate(generatedAt, lang),
        barcode,
      },
      party: {
        client: order.company?.name ?? '—',
        warehouse: warehouse?.name ?? warehouse?.code ?? '—',
        supplier: slot.supplier || '—',
        orderNumber: order.orderNumber || '—',
        reference: slot.clientReference || '—',
        date: formatDocDate(task.completedAt ?? generatedAt, lang),
        operator: slot.operatorName || operatorName,
        poNumber: slot.poNumber || '—',
      },
      items,
      emptyRows: emptyTableRowSlots(items.length),
      summary: {
        totalItems: items.length,
        totalQty: formatQty(totalQty, lang),
        totalSkus: skuSet.size,
        receivedBy: operatorName,
        receivingTime: formatDocDateTime(task.completedAt ?? generatedAt, lang),
      },
      notes: slot.notes,
      signatures: [
        { role: t('warehouseOfficer'), signature: L.signature, nameAndDate: L.nameAndDate },
        { role: t('supervisor'), signature: L.signature, nameAndDate: L.nameAndDate },
        { role: t('clientRepresentative'), signature: L.signature, nameAndDate: L.nameAndDate },
      ],
    };

    const buffer = await this.pdf.render('grn', context, footerContext(this.branding, lang, L));
    const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
    const stored =
      existing && opts?.force
        ? await this.storage.replace(DocumentType.grn, fileName, buffer)
        : await this.storage.write(DocumentType.grn, fileName, buffer);

    if (existing && opts?.force) {
      const doc = await this.documents.refreshFile(existing.id, stored);
      const result = this.toResult(doc);
      this.emitGenerated(order.companyId, {
        documentId: result.id,
        type: DocumentType.grn,
        referenceType: 'inbound_order',
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
      type: DocumentType.grn,
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

    const result = this.toResult(doc);
    this.emitGenerated(order.companyId, {
      documentId: result.id,
      type: DocumentType.grn,
      referenceType: 'inbound_order',
      referenceId: order.id,
      taskId,
      documentNumber: result.documentNumber,
      language: result.language,
      pdfUrl: result.pdfUrl,
    });
    return result;
  }

  private emitGenerated(
    companyId: string,
    payload: {
      documentId: string;
      type: string;
      referenceType: string;
      referenceId: string;
      taskId?: string | null;
      documentNumber: string;
      language: string;
      pdfUrl: string;
    },
  ): void {
    this.realtime.emitDocumentGenerated(companyId, payload);
  }

  private toResult(doc: {
    id: string;
    documentNumber: string;
    filePath: string;
    createdAt: Date;
    language: string;
  }): GeneratedDocumentResult {
    return {
      id: doc.id,
      documentNumber: doc.documentNumber,
      pdfUrl: `/api/documents/${doc.id}/file`,
      pdfPath: doc.filePath,
      generatedAt: doc.createdAt,
      language: doc.language,
    };
  }
}
