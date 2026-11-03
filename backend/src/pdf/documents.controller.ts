import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Body,
} from '@nestjs/common';
import type { Response } from 'express';

import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AuthPrincipal } from '../common/auth/current-user.types';
import { CompanyAccessService } from '../common/company-access/company-access.service';
import { ParseUuidLoosePipe } from '../common/pipes/parse-uuid-loose.pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { DnPdfService } from './dn-pdf.service';
import { FinalContractPdfService } from './final-contract-pdf.service';
import { DocumentSlotOverridesService } from './document-slot-overrides.service';
import { DocumentsService } from './documents.service';
import { GetDocumentSlotQueryDto, UpdateDocumentSlotDto } from './dto/document-slot.dto';
import { GrnPdfService } from './grn-pdf.service';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { normalizeLang } from './i18n';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly grn: GrnPdfService,
    private readonly dn: DnPdfService,
    private readonly finalContract: FinalContractPdfService,
    private readonly slotOverrides: DocumentSlotOverridesService,
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly config: ConfigService,
  ) {}

  /** Paginated GRN / Delivery Note catalog (tenant scoped). */
  @Get('catalog')
  listCatalog(@CurrentUser() user: AuthPrincipal, @Query() query: ListContractsQueryDto) {
    return this.documents.listCatalog(user, query);
  }

  /** List immutable documents attached to an inbound/outbound order (tenant scoped). */
  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListDocumentsQueryDto) {
    return this.documents.listForReference(user, query.referenceType, query.referenceId);
  }

  /** Load editable GRN / DN PDF field values for a task slot. */
  @Get('slot/:taskId')
  async getSlot(
    @CurrentUser() user: AuthPrincipal,
    @Param('taskId', ParseUuidLoosePipe) taskId: string,
    @Query() query: GetDocumentSlotQueryDto,
  ) {
    await this.assertTaskTenant(user, taskId);
    return this.slotOverrides.getEditable(taskId, query.type);
  }

  /** Save GRN / DN PDF field overrides for a task slot. */
  @Patch('slot/:taskId')
  async updateSlot(
    @CurrentUser() user: AuthPrincipal,
    @Param('taskId', ParseUuidLoosePipe) taskId: string,
    @Body() dto: UpdateDocumentSlotDto,
  ) {
    await this.assertTaskTenant(user, taskId);
    return this.slotOverrides.upsert(taskId, dto);
  }

  /** Name shown when the PDF is saved: "GRN-2026-00025 - Client name.pdf" (never an internal id). */
  private async downloadName(doc: {
    companyId: string;
    documentNumber: string;
    language: string;
    fileName: string;
  }): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: doc.companyId },
      select: { name: true, tradeName: true },
    });
    const client = (company?.tradeName || company?.name || '').trim();
    const raw = `${doc.documentNumber}${client ? ` - ${client}` : ''}${doc.language === 'ar' ? ' (AR)' : ''}`;
    const safe = raw.replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return `${safe || doc.fileName.replace(/\.pdf$/i, '')}.pdf`;
  }

  private signLink(id: string, exp: number): string {
    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-only-change-in-production';
    return createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex');
  }

  /**
   * Short-lived link (5 minutes) whose last path segment is the real file name, so the browser's
   * PDF viewer saves it as "GRN-2026-00025 - Client name.pdf" instead of a blob id.
   */
  @Post(':id/link')
  async link(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    const doc = await this.documents.getForDownload(user, id);
    const name = await this.downloadName(doc);
    const exp = Date.now() + 5 * 60_000;
    return {
      url: `/api/documents/public/${id}/${encodeURIComponent(name)}?exp=${exp}&sig=${this.signLink(id, exp)}`,
      fileName: name,
    };
  }

  @Public()
  @Get('public/:id/:filename')
  async publicFile(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    const expNum = Number(exp);
    const expected = this.signLink(id, expNum);
    const ok =
      Number.isFinite(expNum) &&
      expNum > Date.now() &&
      typeof sig === 'string' &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) throw new ForbiddenException('This link has expired. Open the document again.');
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found.');
    const buffer = await readFile(doc.filePath).catch(() => null);
    if (!buffer) throw new NotFoundException('Document file is no longer available on disk.');
    const name = await this.downloadName(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buffer);
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

  /** Explicitly (re)generate a final warehouse contract PDF in a given language. */
  @Post('final-contract/:contractId')
  async generateFinalContract(
    @CurrentUser() user: AuthPrincipal,
    @Param('contractId', ParseUuidLoosePipe) contractId: string,
    @Query('lang') lang?: string,
  ) {
    await this.assertFinalContractTenant(user, contractId);
    return this.finalContract.generateForContract(
      contractId,
      normalizeLang(lang),
      { force: true },
      user.id ?? null,
    );
  }

  private async assertFinalContractTenant(user: AuthPrincipal, contractId: string): Promise<void> {
    const row = await this.prisma.finalContract.findUnique({
      where: { id: contractId },
      select: { companyId: true },
    });
    if (!row) throw new NotFoundException('Final contract not found.');
    this.companyAccess.assertCompanyAccess(user, row.companyId);
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
