import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOmsExportService } from '../order-export/client-oms-export.service';
import { OmsClientImportService } from '../order-import/oms-client-import.service';
import { ClientOmsOrdersService } from './client-oms-orders.service';
import {
  BulkCancelClientOmsOrdersDto,
  BulkConfirmClientOmsOrdersDto,
  ClientOmsOrdersExportDto,
} from './dto/bulk-confirm-client-oms-orders.dto';
import { CreateClientOmsOrderDto } from './dto/create-client-oms-order.dto';
import { ClientCodReportQueryDto } from './dto/client-cod-report-query.dto';
import { ClientOmsStatusSummaryQueryDto } from './dto/client-oms-status-summary-query.dto';
import { ListClientOmsOrdersQueryDto } from './dto/list-client-oms-orders-query.dto';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/oms')
export class ClientOmsOrdersController {
  constructor(
    private readonly oms: ClientOmsOrdersService,
    private readonly importSvc: OmsClientImportService,
    private readonly exportSvc: ClientOmsExportService,
  ) {}

  @Get('orders')
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListClientOmsOrdersQueryDto) {
    return this.oms.list(client, query);
  }

  /** Must be registered before `orders/:id` so "status-summary" is not parsed as an id. */
  @Get('orders/status-summary')
  statusSummary(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ClientOmsStatusSummaryQueryDto,
  ) {
    return this.oms.statusSummary(client, query);
  }

  @Get('orders/import/template')
  @Header('Cache-Control', 'no-store')
  importTemplate(@Res({ passthrough: true }) res: Response) {
    const result = this.importSvc.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.body;
  }

  @Post('orders/import')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async importOrders(
    @ClientUser() client: ClientPrincipal,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel or CSV file is required.');
    }
    return this.importSvc.importFile(client, file.buffer, file.originalname);
  }

  @Post('orders')
  create(@ClientUser() client: ClientPrincipal, @Body() dto: CreateClientOmsOrderDto) {
    return this.oms.create(client, dto);
  }

  @Post('orders/confirm-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirmBulk(
    @ClientUser() client: ClientPrincipal,
    @Body() dto: BulkConfirmClientOmsOrdersDto,
  ) {
    return this.oms.confirmBulk(client, dto.ids);
  }

  @Post('orders/cancel-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  cancelBulk(
    @ClientUser() client: ClientPrincipal,
    @Body() dto: BulkCancelClientOmsOrdersDto,
  ) {
    return this.oms.cancelBulk(client, dto.ids);
  }

  @Get('orders/export/columns')
  exportColumns() {
    return this.exportSvc.columns();
  }

  @Post('orders/export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrders(
    @ClientUser() client: ClientPrincipal,
    @Body() dto: ClientOmsOrdersExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.exportSvc.exportCsv(client, dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Post('orders/:id/confirm')
  confirm(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.confirm(client, id);
  }

  @Post('orders/:id/cancel')
  cancel(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.cancel(client, id);
  }

  @Post('orders/:id/cancel-revert')
  cancelRevert(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.revertCancel(client, id);
  }

  @Get('orders/:id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.findOne(client, id);
  }

  @Get('orders/:id/timeline')
  timeline(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.timeline(client, id);
  }

  @Get('cod-report')
  codReport(@ClientUser() client: ClientPrincipal, @Query() query: ClientCodReportQueryDto) {
    return this.oms.codReport(client, query);
  }
}
