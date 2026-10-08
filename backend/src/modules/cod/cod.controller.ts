import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CodRecordStatus } from '@prisma/client';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CodRecordsService } from './cod-records.service';
import {
  CreateCodAdjustmentDto,
  ListCodRecordsQueryDto,
  SetCodStatusByScanDto,
  UpdateCodStatusDto,
} from './dto/cod.dto';

@Controller('cod')
export class CodController {
  constructor(private readonly cod: CodRecordsService) {}

  @Get('records')
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListCodRecordsQueryDto) {
    return this.cod.list(user, query);
  }

  @Post('status-by-scan')
  setStatusByScan(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: SetCodStatusByScanDto,
  ) {
    return this.cod.setStatusByScan(user, dto.code, dto.status as CodRecordStatus);
  }

  @Get('records/export')
  @Header('Cache-Control', 'no-store')
  async exportRecords(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListCodRecordsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.cod.exportCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cod-records.csv"');
    res.send(csv);
  }

  @Get('records/:id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cod.findById(id, user);
  }

  @Get('by-order/:omsOrderId')
  byOrder(
    @CurrentUser() user: AuthPrincipal,
    @Param('omsOrderId', ParseUuidLoosePipe) omsOrderId: string,
  ) {
    return this.cod.findByOmsOrder(omsOrderId, user);
  }

  @Post('orders/:omsOrderId/retry')
  retry(
    @CurrentUser() user: AuthPrincipal,
    @Param('omsOrderId', ParseUuidLoosePipe) omsOrderId: string,
  ) {
    return this.cod.retryGeneration(omsOrderId, user);
  }

  @Patch('records/:id/status')
  setStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateCodStatusDto,
  ) {
    return this.cod.setStatus(id, user, dto.status as CodRecordStatus);
  }

  @Post('records/:id/adjustments')
  adjust(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: CreateCodAdjustmentDto,
  ) {
    return this.cod.addManualAdjustment(id, user, dto);
  }
}
