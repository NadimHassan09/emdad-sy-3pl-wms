import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCredentialScope } from '@prisma/client';

import { resolveBranding } from '../../../pdf/branding';
import { brandContext, footerContext } from '../../../pdf/pdf-context.util';
import { buildLabels, formatDocDate } from '../../../pdf/i18n';
import { PdfService } from '../../../pdf/pdf.service';
import { AUTH_ALTERNATIVE, canonicalApiDocs } from './canonical-api-docs';

const SCOPE_LABEL: Record<ApiCredentialScope, string> = {
  oms: 'OMS Orders API',
  inbound: 'Inbound Orders API',
  outbound: 'Outbound Orders API',
};

@Injectable()
export class ApiDocsService {
  constructor(
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {}

  async render(scope: ApiCredentialScope): Promise<Buffer> {
    const branding = resolveBranding(this.config);
    const lang = 'en' as const;
    const L = buildLabels(lang);
    const baseUrl =
      this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ||
      'https://client.emdadsy.com/api/v1';
    const docs = canonicalApiDocs(scope);

    return this.pdf.render(
      'api_docs',
      {
        lang,
        dir: 'ltr',
        brand: brandContext(branding, lang, this.pdf.logo),
        header: {
          titleMain: docs.title,
          referenceNo: 'EMDAD API',
          issueDate: formatDocDate(new Date(), lang),
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
        authAlternative: AUTH_ALTERNATIVE,
        baseUrl,
        isOms: scope === 'oms',
        isInbound: scope === 'inbound',
        isOutbound: scope === 'outbound',
      },
      footerContext(branding, lang, L),
    );
  }
}
