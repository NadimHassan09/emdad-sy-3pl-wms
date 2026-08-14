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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
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
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';
import { OmsDashboardOrderSummaryQueryDto } from './dto/oms-dashboard-order-summary-query.dto';

@Controller('oms')
export class OmsController {
  constructor(
    private readonly orders: OmsOrdersService,
    private readonly dashboard: OmsDashboardService,
    private readonly csv: OmsOrdersCsvService,
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

  @Get('orders/import/template')
  @Header('Cache-Control', 'no-store')
  importTemplate(@Res({ passthrough: true }) res: Response) {
    const result = this.csv.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.body;
  }

  @Post('orders/import/validate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async validateImport(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV file is required.');
    }
    const result = await this.csv.validateImport(user, file.buffer);
    const { _validPayloads: _, ...publicResult } = result;
    return publicResult;
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
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV file is required.');
    }
    return this.csv.executeImport(user, file.buffer);
  }

  @Post('orders')
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOmsOrderDto) {
    // Backend enforces: admin create → processing + outbound (idempotent).
    return this.orders.create(user, dto, { provisionOutbound: !dto.outboundOrderId });
  }

  @Get('orders/:id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.findById(id, user);
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
}
