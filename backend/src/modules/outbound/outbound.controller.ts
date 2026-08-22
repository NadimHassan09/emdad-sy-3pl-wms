import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
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
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ConfirmOutboundBodyDto } from './dto/confirm-outbound-body.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';
import { UpdateOutboundPlanDto } from './dto/update-outbound-plan.dto';
import { UpdateShippingDetailsDto } from './dto/update-shipping-details.dto';
import { OutboundOrdersCsvService } from './outbound-orders-csv.service';
import { OutboundService } from './outbound.service';

@Controller('outbound-orders')
export class OutboundController {
  constructor(
    private readonly outbound: OutboundService,
    private readonly csv: OutboundOrdersCsvService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOutboundOrderDto) {
    return this.outbound.create(user, dto);
  }

  @Post('quick-directed')
  quickDirected() {
    throw new GoneException('Quick directed outbound is no longer available.');
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListOutboundQueryDto) {
    return this.outbound.list(user, query);
  }

  /** Filtered CSV export — same filters as GET /outbound-orders (must be before :id). */
  @Get('export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrders(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListOutboundQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.csv.exportCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get('import/template')
  @Header('Cache-Control', 'no-store')
  importTemplate(@Res({ passthrough: true }) res: Response) {
    const result = this.csv.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.body;
  }

  @Post('import/validate')
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

  @Post('import')
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

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.findById(id, user);
  }

  @Patch(':id/plan')
  updatePlan(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: UpdateOutboundPlanDto,
  ) {
    return this.outbound.updatePlan(user, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.approveAdmin(user, id);
  }

  @Post(':id/complete-picking')
  completePicking(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.completePickingAdmin(user, id);
  }

  @Post(':id/complete-packing')
  completePacking(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.completePackingAdmin(user, id);
  }

  @Post(':id/select-shipping-method')
  selectShippingMethod(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: UpdateShippingDetailsDto & { shippingMethod: string },
  ) {
    return this.outbound.selectShippingMethodAdmin(user, id, body);
  }

  @Patch(':id/shipping-details')
  saveShippingDetails(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: UpdateShippingDetailsDto,
  ) {
    return this.outbound.saveShippingDetails(user, id, body);
  }

  @Post(':id/shipping-details/send')
  sendShippingDetails(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.sendShippingDetails(user, id);
  }

  @Post(':id/complete-shipping-details')
  completeShippingDetails(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.completeShippingDetailsAdmin(user, id);
  }

  @Post(':id/complete-dispatch')
  completeDispatch(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.completeDispatchAdmin(user, id);
  }

  /** @deprecated Prefer stage endpoints; advances exactly one Admin stage. */
  @Post(':id/execute-admin')
  executeAdmin(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.executeAdmin(user, id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: ConfirmOutboundBodyDto,
  ) {
    return this.outbound.confirmAndDeduct(user, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.cancel(id, user);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.remove(id, user);
  }
}
