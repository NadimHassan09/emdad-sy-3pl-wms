import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DnPdfService } from './dn-pdf.service';
import { GrnPdfService } from './grn-pdf.service';
import { DocLang, normalizeLang } from './i18n';

/**
 * Thin facade used by the warehouse-workflow module to auto-generate documents
 * after a task completes. All methods are error-safe (a PDF failure must never
 * affect the already-committed inventory transaction) and idempotent.
 */
@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger(DocumentGenerationService.name);
  private readonly defaultLang: DocLang;

  constructor(
    private readonly grn: GrnPdfService,
    private readonly dn: DnPdfService,
    config: ConfigService,
  ) {
    this.defaultLang = normalizeLang(config.get<string>('DOCUMENT_DEFAULT_LANG') ?? 'en');
  }

  /** GRN — generated immediately after a Receiving task is completed. */
  async generateGrnForReceiving(taskId: string, lang?: DocLang): Promise<void> {
    try {
      await this.grn.generateForReceivingTask(taskId, lang ?? this.defaultLang);
    } catch (err) {
      this.logger.error(`Failed to auto-generate GRN for receiving task ${taskId}: ${String(err)}`);
    }
  }

  /** Delivery Note — generated only after a Dispatch task is completed. */
  async generateDnForDispatch(taskId: string, lang?: DocLang): Promise<void> {
    try {
      await this.dn.generateForDispatchTask(taskId, lang ?? this.defaultLang);
    } catch (err) {
      this.logger.error(`Failed to auto-generate Delivery Note for dispatch task ${taskId}: ${String(err)}`);
    }
  }

  defaultLanguage(): DocLang {
    return this.defaultLang;
  }
}
