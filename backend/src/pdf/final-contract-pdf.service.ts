import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentBranding, resolveBranding } from './branding';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsService } from './documents.service';
import {
  FC_LABELS,
  FC_PRICING_ROWS,
  FC_PROVIDER_OBLIGATIONS,
  FC_CLIENT_OBLIGATIONS,
  FC_TERM_BULLETS,
  FC_LIABILITY_BULLETS,
  FC_GENERAL_BULLETS,
  FC_SCOPE_SERVICES,
  fcBullets,
  fcLabels,
  fcMsg,
  formatUsd,
} from './final-contract-i18n';
import { barcodePngDataUri } from './barcode.util';
import type { GenerateDocumentOptions, GeneratedDocumentResult } from './grn-pdf.service';
import { DocLang, buildLabels, formatDocDate } from './i18n';
import { brandContext, footerContext } from './pdf-context.util';
import { PdfService } from './pdf.service';

@Injectable()
export class FinalContractPdfService {
  private readonly logger = new Logger(FinalContractPdfService.name);
  private readonly branding: DocumentBranding;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: DocumentStorageService,
    private readonly documents: DocumentsService,
    config: ConfigService,
  ) {
    this.branding = resolveBranding(config);
  }

  async generateForContract(
    contractId: string,
    lang: DocLang,
    opts?: GenerateDocumentOptions,
    generatedBy?: string | null,
  ): Promise<GeneratedDocumentResult | null> {
    const existing = await this.documents.findByReference(
      DocumentType.final_contract,
      contractId,
      lang,
    );
    if (existing && !opts?.force) return this.toResult(existing);

    const contract = await this.prisma.finalContract.findUnique({
      where: { id: contractId },
      include: { company: true },
    });
    if (!contract) {
      this.logger.warn(`Final contract PDF skipped — contract ${contractId} not found.`);
      return null;
    }

    const L = fcLabels(lang);
    const footerLabels = buildLabels(lang);
    const generatedAt = new Date();
    const documentNumber = existing?.documentNumber ?? contract.contractNumber;
    const barcode = await barcodePngDataUri(documentNumber);

    const rates = {
      rateStorage: Number(contract.rateStorage),
      rateInboundHandling: Number(contract.rateInboundHandling),
      rateOutboundHandling: Number(contract.rateOutboundHandling),
      rateValueAddedServices: Number(contract.rateValueAddedServices),
      rateReturnProcessing: Number(contract.rateReturnProcessing),
    };

    const pricingRows = FC_PRICING_ROWS.map((row) => ({
      service: fcMsg(row.service, lang),
      description: fcMsg(row.description, lang),
      unit: fcMsg(row.unit, lang),
      billing: fcMsg(row.billing, lang),
      rate: formatUsd(rates[row.rateKey], lang),
    }));

    const issueDateFormatted = formatDocDate(contract.issueDate, lang);

    const context = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      L,
      brand: brandContext(this.branding, lang, this.pdf.logo),
      header: {
        titleMain: L.documentTitle,
        titleAbbr: fcMsg(FC_LABELS.contractNo, lang),
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
      scopeServices: FC_SCOPE_SERVICES.map((item, idx) => ({
        idx: idx + 1,
        label: fcMsg(item, lang),
      })),
      pricingRows,
      providerObligations: fcBullets(FC_PROVIDER_OBLIGATIONS, lang),
      clientObligations: fcBullets(FC_CLIENT_OBLIGATIONS, lang),
      termBullets: fcBullets(FC_TERM_BULLETS, lang),
      liabilityBullets: fcBullets(FC_LIABILITY_BULLETS, lang),
      generalBullets: fcBullets(FC_GENERAL_BULLETS, lang),
    };

    const buffer = await this.pdf.render(
      'final_contract',
      context,
      footerContext(this.branding, lang, footerLabels),
    );
    const fileName = existing?.fileName ?? `${documentNumber}-${lang}.pdf`;
    const stored =
      existing && opts?.force
        ? await this.storage.replace(DocumentType.final_contract, fileName, buffer)
        : await this.storage.write(DocumentType.final_contract, fileName, buffer);

    if (existing && opts?.force) {
      const doc = await this.documents.refreshFile(existing.id, stored);
      return this.toResult(doc);
    }

    const doc = await this.documents.create({
      companyId: contract.companyId,
      type: DocumentType.final_contract,
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
