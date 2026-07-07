import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentBranding, resolveBranding } from './branding';
import { DocumentStorageService } from './document-storage.service';
import { DocumentSlotOverridesService } from './document-slot-overrides.service';
import { DocumentsService } from './documents.service';
import { GeneratedDocumentResult, GenerateDocumentOptions } from './grn-pdf.service';
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

@Injectable()
export class DnPdfService {
  private readonly logger = new Logger(DnPdfService.name);
  private readonly branding: DocumentBranding;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: DocumentStorageService,
    private readonly documents: DocumentsService,
    private readonly slotOverrides: DocumentSlotOverridesService,
    config: ConfigService,
  ) {
    this.branding = resolveBranding(config);
  }

  /** Build the immutable Delivery Note for a completed dispatch task. */
  async generateForDispatchTask(
    taskId: string,
    lang: DocLang,
    opts?: GenerateDocumentOptions,
  ): Promise<GeneratedDocumentResult | null> {
    const existing = await this.documents.findByTask(DocumentType.delivery_note, taskId, lang);
    if (existing && !opts?.force) return this.toResult(existing);

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

    const t = makeTranslator(lang);
    const L = buildLabels(lang);

    const skuSet = new Set<string>();
    let totalQty = 0;

    const items = order.lines.map((line, idx) => {
      const ordered = Number(line.requestedQuantity ?? 0);
      const picked = Number(line.pickedQuantity ?? 0);
      // Dispatch validation guarantees ship_qty === picked_qty for shipped orders.
      const shipped = picked;
      totalQty += shipped;
      if (line.productId) skuSet.add(line.productId);
      return {
        idx: idx + 1,
        sku: line.product?.sku ?? '—',
        name: line.product?.name ?? '—',
        orderedQty: formatQty(ordered, lang),
        pickedQty: formatQty(picked, lang),
        shippedQty: formatQty(shipped, lang),
        unit: line.product?.uom ?? '',
      };
    });

    const generatedAt = new Date();
    const documentNumber =
      existing?.documentNumber ?? (await this.documents.nextNumber(DocumentType.delivery_note));
    const operatorName = operator?.fullName ?? '—';
    const carrier = (order.carrier ?? '').trim() || '—';
    const tracking = (order.trackingNumber ?? '').trim() || '—';
    const barcode = await barcodePngDataUri(documentNumber);
    const slot = (await this.slotOverrides.getEditable(taskId, DocumentType.delivery_note)).fields;

    const context = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      L,
      brand: brandContext(this.branding, lang, this.pdf.logo),
      header: {
        titleMain: t('documentTitleDn'),
        titleAbbr: t('dnAbbr'),
        referenceNo: documentNumber,
        issueDate: formatDocDate(generatedAt, lang),
        barcode,
      },
      party: {
        customer: order.company?.name ?? '—',
        destination: slot.destination || order.destinationAddress || '—',
        warehouse: warehouse?.name ?? warehouse?.code ?? '—',
        orderNumber: order.orderNumber || '—',
        reference: slot.clientReference || '—',
        date: formatDocDate(order.shippedAt ?? task.completedAt ?? generatedAt, lang),
        carrier: slot.carrier || carrier,
        tracking: slot.trackingNumber || tracking,
        vehicle: slot.vehicle || '—',
        driver: slot.driver || '—',
      },
      items,
      emptyRows: emptyTableRowSlots(items.length),
      summary: {
        totalItems: items.length,
        totalQty: formatQty(totalQty, lang),
        totalSkus: skuSet.size,
        preparedBy: operatorName,
        releasedBy: operatorName,
        dispatchTime: formatDocDateTime(order.shippedAt ?? task.completedAt ?? generatedAt, lang),
      },
      notes: slot.notes,
      signatures: [
        { role: t('warehouseSign'), signature: L.signature, nameAndDate: L.nameAndDate },
        { role: t('driverSign'), signature: L.signature, nameAndDate: L.nameAndDate },
        { role: t('customerSign'), signature: L.signature, nameAndDate: L.nameAndDate },
      ],
    };

    const buffer = await this.pdf.render('dn', context, footerContext(this.branding, lang, L));
    const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
    const stored =
      existing && opts?.force
        ? await this.storage.replace(DocumentType.delivery_note, fileName, buffer)
        : await this.storage.write(DocumentType.delivery_note, fileName, buffer);

    if (existing && opts?.force) {
      const doc = await this.documents.refreshFile(existing.id, stored);
      return this.toResult(doc);
    }

    const doc = await this.documents.create({
      companyId: order.companyId,
      type: DocumentType.delivery_note,
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

    return this.toResult(doc);
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
