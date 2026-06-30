import { Module } from '@nestjs/common';

import { DnPdfService } from './dn-pdf.service';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { GrnPdfService } from './grn-pdf.service';
import { PdfService } from './pdf.service';

/**
 * Reusable PDF document module: a Puppeteer rendering engine plus immutable
 * GRN / Delivery Note generation, storage and download endpoints.
 */
@Module({
  controllers: [DocumentsController],
  providers: [
    PdfService,
    DocumentStorageService,
    DocumentsService,
    GrnPdfService,
    DnPdfService,
    DocumentGenerationService,
  ],
  exports: [DocumentGenerationService, GrnPdfService, DnPdfService, DocumentsService],
})
export class PdfModule {}
