import { readFile } from 'node:fs/promises';

import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthPrincipal } from '../common/auth/current-user.types';
import { CompanyAccessService } from '../common/company-access/company-access.service';
import { ParseUuidLoosePipe } from '../common/pipes/parse-uuid-loose.pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { DnPdfService } from './dn-pdf.service';
import { DocumentsService } from './documents.service';
import { GrnPdfService } from './grn-pdf.service';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { normalizeLang } from './i18n';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly grn: GrnPdfService,
    private readonly dn: DnPdfService,
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  /** List immutable documents attached to an inbound/outbound order (tenant scoped). */
  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListDocumentsQueryDto) {
    return this.documents.listForReference(user, query.referenceType, query.referenceId);
  }

  /** Stream a stored PDF (immutable) inline. */
  @Get(':id/file')
  async file(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.documents.getForDownload(user, id);
    const buffer = await readFile(doc.filePath).catch(() => null);
    if (!buffer) {
      throw new NotFoundException('Document file is no longer available on disk.');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buffer);
  }

  /** Explicitly (re)generate a GRN for a receiving task in a given language. */
  @Post('grn/:taskId')
  async generateGrn(
    @CurrentUser() user: AuthPrincipal,
    @Param('taskId', ParseUuidLoosePipe) taskId: string,
    @Query('lang') lang?: string,
  ) {
    await this.assertTaskTenant(user, taskId);
    return this.grn.generateForReceivingTask(taskId, normalizeLang(lang), { force: true });
  }

  /** Explicitly (re)generate a Delivery Note for a dispatch task in a given language. */
  @Post('dn/:taskId')
  async generateDn(
    @CurrentUser() user: AuthPrincipal,
    @Param('taskId', ParseUuidLoosePipe) taskId: string,
    @Query('lang') lang?: string,
  ) {
    await this.assertTaskTenant(user, taskId);
    return this.dn.generateForDispatchTask(taskId, normalizeLang(lang), { force: true });
  }

  private async assertTaskTenant(user: AuthPrincipal, taskId: string): Promise<void> {
    const task = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      include: { workflowInstance: { select: { companyId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found.');
    this.companyAccess.assertCompanyAccess(user, task.workflowInstance.companyId);
  }
}
