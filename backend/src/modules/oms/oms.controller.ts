import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
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

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import {
  AdjustShippingFeeBulkDto,
  AdjustShippingFeeDto,
} from './dto/adjust-shipping-fee.dto';
import { AdjustCarrierCostDto } from './dto/adjust-carrier-cost.dto';
import {
  AllocateOmsOrderDto,
  ApproveOmsOrderDto,
  CreateOmsOrderDto,
  RejectOmsOrderDto,
  RevertOmsDeliveryDto,
  UpdateOmsOrderDto,
} from './dto/oms-order.dto';
import { OmsDashboardService } from './oms-dashboard.service';
import { OmsOrdersCsvService } from './oms-orders-csv.service';
import { OmsOrdersService } from './oms-orders.service';
import { OmsBulkService } from './oms-bulk.service';
import { BulkApproveOmsOrdersDto } from './dto/bulk-approve-oms-orders.dto';
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';
import { OmsDashboardOrderSummaryQueryDto } from './dto/oms-dashboard-order-summary-query.dto';
import { OmsOrdersExportDto } from './dto/oms-orders-export.dto';
import { ExportWaybillsDto } from './dto/export-waybills.dto';
import { OmsWaybillService } from './oms-waybill.service';
import { OmsInstructionPdfService } from './oms-instruction-pdf.service';
import { sendImportTemplateResponse } from '../client-portal/order-import/import-template-xlsx';
import { OmsClientImportService } from '../client-portal/order-import/oms-client-import.service';
import { OmsShippingScanService } from './oms-shipping-scan.service';
import { ScanShippingTransitionDto } from './dto/scan-shipping-transition.dto';
import { InboundTraceabilityService } from './inbound-traceability.service';

@Controller('oms')
export class OmsController {
  constructor(
    private readonly orders: OmsOrdersService,
    private readonly bulk: OmsBulkService,
    private readonly dashboard: OmsDashboardService,
    private readonly csv: OmsOrdersCsvService,
    private readonly clientImport: OmsClientImportService,
    private readonly waybillService: OmsWaybillService,
    private readonly instructionPdf: OmsInstructionPdfService,
    private readonly shippingScan: OmsShippingScanService,
    private readonly traceability: InboundTraceabilityService,
  ) {}

  @Get('dashboard')
  dashboardSummary(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyId?: string,
  ) {
    return this.dashboard.summary(user, companyId);
  }

  /** Must be registered before any `dashboard/:id`-style routes. */
  @Get('dashboard/order-summary')
  orderSummary(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: OmsDashboardOrderSummaryQueryDto,
  ) {
    return this.dashboard.orderSummary(user, query);
  }

  @Get('orders')
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListOmsOrdersQueryDto) {
    return this.orders.list(user, query);
  }

  /** Status-card and operational-stage counts. Must stay ahead of orders/:id. */
  @Get('orders/nav-counts')
  statusNavCounts(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListOmsOrdersQueryDto,
  ) {
    return this.orders.statusNavCounts(user, query);
  }

  /** Filtered CSV export — same filters as GET /oms/orders (must be before :id). */
  @Get('orders/export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrders(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListOmsOrdersQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.csv.exportCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get('orders/export/columns')
  exportColumns() {
    return this.csv.columns();
  }

  /** Preferred export path — column picker + optional selected ids. */
  @Post('orders/export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrdersPost(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: OmsOrdersExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { columnIds, arabicHeaders, ids, format = 'csv', ...query } = dto;
    if (format === 'xlsx') {
      const result = await this.csv.exportXlsx(user, query, { columnIds, arabicHeaders, ids });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Export-Row-Count', String(result.rowCount));
      res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
      return result.buffer;
    }
    const result = await this.csv.exportCsv(user, query, { columnIds, arabicHeaders, ids });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get('orders/import/template')
  @Header('Cache-Control', 'no-store')
  async importTemplate(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    await sendImportTemplateResponse(
      res,
      format,
      () => this.clientImport.getImportTemplate(),
      () => this.clientImport.getImportTemplateXlsx(),
    );
  }

  @Post('orders/import/validate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async validateImport() {
    throw new BadRequestException(
      'Client-format import validates on upload. Use POST /oms/orders/import with companyId.',
    );
  }

  @Post('orders/import')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async importOrders(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('companyId') companyId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV file is required.');
    }
    if (!companyId?.trim()) {
      throw new BadRequestException('companyId is required.');
    }
    const summary = await this.clientImport.importFileForCompany(
      user,
      companyId.trim(),
      file.buffer,
      file.originalname,
    );
    return {
      ...summary,
      imported: summary.created,
      failed: summary.invalid,
      skippedDuplicates: summary.duplicate,
      createdOrderNumbers: summary.createdOrderNumbers,
      errors: summary.errors.map((e) => ({
        rowNumber: e.rowNumber,
        externalReference: e.orderNumber,
        reason: e.error,
      })),
    };
  }

  @Post('orders')
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOmsOrderDto) {
    return this.orders.create(user, dto);
  }

  /** QR confirm ready-to-ship / physical handover. Must stay before `orders/:id`. */
  @Post('orders/scan-shipping-transition')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  scanShippingTransition(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ScanShippingTransitionDto,
  ) {
    return this.shippingScan.apply(user, dto.code, dto.action);
  }

  /** Bulk approve — must stay declared before the `orders/:id` routes. */
  @Post('orders/approve-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  approveBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.approveBulk(user, dto.ids);
  }

  /** Bulk confirm — must stay declared before the `orders/:id` routes. */
  @Post('orders/confirm-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirmBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.confirmBulk(user, dto.ids);
  }

  /** Bulk cancel — must stay declared before the `orders/:id` routes. */
  @Post('orders/cancel-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  cancelBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.cancelBulk(user, dto.ids);
  }

  /** Bulk cancel shipments */
  @Post('orders/cancel-shipments-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  cancelShipmentsBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.orders.cancelShipmentsBulk(dto.ids, user);
  }

  /** Bulk delivered */
  @Post('orders/delivered-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deliveredBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.deliveredBulk(user, dto.ids);
  }

  /** Bulk failed delivery */
  @Post('orders/failed-delivery-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  failedDeliveryBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.failedDeliveryBulk(user, dto.ids);
  }

  /** Bulk returned */
  @Post('orders/returned-bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  returnedBulk(@CurrentUser() user: AuthPrincipal, @Body() dto: BulkApproveOmsOrdersDto) {
    return this.bulk.returnedBulk(user, dto.ids);
  }

  /** Bulk manual shipping fee adjustment — must stay declared before the `orders/:id` routes. */
  @Post('orders/adjust-shipping-fee-bulk')
  @UseGuards(InternalAdminGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  adjustShippingFeeBulk(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: AdjustShippingFeeBulkDto,
  ) {
    return this.bulk.adjustShippingFeeBulk(user, dto);
  }

  @Post('orders/waybills/export-excel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportWaybillsExcel(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ExportWaybillsDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.waybillService.exportWaybillsExcel(dto.orderIds, user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.byteLength.toString());
    res.setHeader('X-Export-Row-Count', String(result.count));
    res.end(result.buffer);
  }

  @Post('orders/waybills/pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async downloadWaybillsPdf(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ExportWaybillsDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.waybillService.generateCombinedWaybillPdf(dto.orderIds, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.byteLength.toString());
    res.setHeader('X-Label-Count', String(result.count));
    res.end(result.buffer);
  }

  @Post('orders/instructions/pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async downloadInstructionsPdf(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: BulkApproveOmsOrdersDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.instructionPdf.downloadCombined(user, dto.ids);
    this.sendDownload(res, buffer, filename, 'application/pdf');
  }

  @Post('orders/instructions/zip')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async downloadInstructionsZip(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: BulkApproveOmsOrdersDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.instructionPdf.downloadZip(user, dto.ids);
    this.sendDownload(res, buffer, filename, 'application/zip');
  }

  @Get('orders/:id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.findById(id, user);
  }

  @Get('orders/:id/traceability')
  getTraceability(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.traceability.getTraceabilityForOrder(id, user);
  }

  @Patch('orders/:id')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateOmsOrderDto,
  ) {
    // Field updates only — status is never accepted on PATCH (see UpdateOmsOrderDto).
    return this.orders.update(id, user, dto);
  }

  @Delete('orders/:id')
  delete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.delete(id, user);
  }

  @Post('orders/:id/confirm')
  confirm(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.confirm(id, user);
  }

  @Post('orders/:id/approve')
  approve(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ApproveOmsOrderDto,
  ) {
    return this.orders.approve(id, user, dto);
  }

  /** Single order manual shipping fee adjustment. */
  @Post('orders/:id/adjust-shipping-fee')
  @UseGuards(InternalAdminGuard)
  adjustShippingFee(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AdjustShippingFeeDto,
  ) {
    return this.orders.adjustShippingFee(user, id, dto, { mode: 'single' });
  }

  /** Manual override of internal carrier cost (USD). Does not notify the carrier. */
  @Post('orders/:id/adjust-carrier-cost')
  @UseGuards(InternalAdminGuard)
  adjustCarrierCost(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AdjustCarrierCostDto,
  ) {
    return this.orders.adjustCarrierCost(user, id, dto);
  }

  @Post('orders/:id/reject')
  reject(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: RejectOmsOrderDto,
  ) {
    return this.orders.reject(id, user, dto);
  }

  @Post('orders/:id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.cancel(id, user);
  }

  @Post('orders/:id/cancel-shipment')
  cancelShipment(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body?: { reason?: string; force?: boolean },
  ) {
    return this.orders.cancelShipment(id, user, body?.reason, body?.force);
  }

  @Post('orders/:id/cancel-revert')
  cancelRevert(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.revertCancel(id, user);
  }

  @Post('orders/:id/failed-delivery')
  failedDelivery(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markFailedDelivery(id, user);
  }

  @Post('orders/:id/complete')
  complete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markCompleted(id, user);
  }

  @Post('orders/:id/allocate')
  allocate(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AllocateOmsOrderDto,
  ) {
    return this.orders.allocate(id, user, dto);
  }

  @Post('orders/:id/release-allocation')
  releaseAllocation(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.releaseAllocation(id, user);
  }

  @Post('orders/:id/out-for-delivery')
  outForDelivery(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    // Deprecated: prefer WMS sync → shipped. Kept for compatibility.
    return this.orders.markOutForDelivery(id, user);
  }

  @Post('orders/:id/external-fulfillment')
  recordExternalFulfillment(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.recordExternalFulfillment(id, user);
  }

  @Post('orders/:id/delivered')
  delivered(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markDelivered(id, user);
  }

  @Post('orders/:id/delivery-revert')
  deliveryRevert(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: RevertOmsDeliveryDto,
  ) {
    return this.orders.revertDelivery(id, user, dto);
  }

  @Post('orders/:id/confirm-return-receipt')
  confirmReturnReceipt(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.confirmReturnReceipt(id, user);
  }

  @Post('orders/:id/undo-confirmed-return')
  undoConfirmedReturn(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.undoConfirmedReturn(id, user);
  }

  @Post('orders/:id/rollback-return')
  rollbackReturn(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body?: { targetStatus?: 'out_for_delivery' | 'ready_to_ship' },
  ) {
    return this.orders.rollbackReturn(id, user, body);
  }

  @Post('orders/:id/returned')
  returned(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markReturned(id, user);
  }

  @Post('orders/:id/cod/collect')
  collectCod(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.collectCod(id, user);
  }

  @Post('orders/:id/cod/settle')
  settleCod(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.settleCod(id, user);
  }

  @Get('orders/:id/timeline')
  timeline(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.timeline(id, user);
  }

  @Get('orders/:id/shipping-movement')
  shippingMovement(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.getShippingMovement(id, user);
  }

  @Get('orders/:id/instructions/pdf')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async downloadOrderInstructionsPdf(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.instructionPdf.downloadOne(user, id);
    this.sendDownload(res, buffer, filename, 'application/pdf');
  }

  @Get('orders/:id/waybill')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  getWaybill(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.waybillService.getWaybillData(id, user);
  }

  @Get('orders/:id/waybill/pdf')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  async downloadWaybillPdf(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.waybillService.generateWaybillPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.end(buffer);
  }

  private sendDownload(res: Response, buffer: Buffer, filename: string, contentType: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.end(buffer);
  }
}
