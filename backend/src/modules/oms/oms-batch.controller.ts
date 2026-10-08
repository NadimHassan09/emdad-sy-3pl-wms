import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateOmsBatchDto, OmsBatchMembershipDto } from './dto/create-oms-batch.dto';
import { OmsBatchService } from './oms-batch.service';
import { OmsInstructionPdfService } from './oms-instruction-pdf.service';
import { OmsWaybillService } from './oms-waybill.service';

@Controller('oms/batches')
export class OmsBatchController {
  constructor(
    private readonly batches: OmsBatchService,
    private readonly instructionPdf: OmsInstructionPdfService,
    private readonly waybills: OmsWaybillService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOmsBatchDto) {
    return this.batches.create(user, dto.ids, dto.name);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query('search') search?: string) {
    return this.batches.list(user, search);
  }

  @Get(':id/instructions/pdf')
  @Header('Cache-Control', 'no-store')
  async downloadInstructions(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Query('kind') kind: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const normalized =
      kind === 'picking' || kind === 'packing' || kind === 'full' ? kind : 'full';
    const { buffer, filename } = await this.instructionPdf.downloadBatch(user, id, normalized);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.end(buffer);
  }

  @Post(':id/labels/pdf')
  @Header('Cache-Control', 'no-store')
  async downloadLabels(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: OmsBatchMembershipDto,
    @Res() res: Response,
  ): Promise<void> {
    const batch = await this.batches.get(user, id);
    const members = new Set(batch.orders.map((row) => row.order.id));
    const ids = dto.ids.filter((orderId) => members.has(orderId));
    const { buffer, filename, count } = await this.waybills.generateCombinedWaybillPdf(ids, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.setHeader('X-Label-Count', String(count));
    res.end(buffer);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.batches.get(user, id);
  }

  @Post(':id/orders')
  addOrders(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: OmsBatchMembershipDto,
  ) {
    return this.batches.addOrders(user, id, dto.ids);
  }

  @Post(':id/remove-orders')
  remove(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: OmsBatchMembershipDto,
  ) {
    return this.batches.removeOrders(user, id, dto.ids);
  }

  @Post(':id/flag-orders')
  flag(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: OmsBatchMembershipDto,
  ) {
    return this.batches.flagOrders(user, id, dto.ids, dto.note ?? '');
  }

  @Post(':id/clear-flags')
  clearFlags(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: OmsBatchMembershipDto,
  ) {
    return this.batches.clearFlags(user, id, dto.ids);
  }
}
