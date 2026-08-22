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
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ConfirmInboundBodyDto } from './dto/confirm-inbound-body.dto';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateInboundOrderDto } from './dto/create-inbound.dto';
import { ListInboundQueryDto } from './dto/list-inbound-query.dto';
import { ReceiveLineDto } from './dto/receive-line.dto';
import { UpdateInboundPlanDto } from './dto/update-inbound-plan.dto';
import { InboundOrdersCsvService } from './inbound-orders-csv.service';
import { InboundService } from './inbound.service';

@Controller('inbound-orders')
export class InboundController {
  constructor(
    private readonly inbound: InboundService,
    private readonly csv: InboundOrdersCsvService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateInboundOrderDto) {
    return this.inbound.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListInboundQueryDto) {
    return this.inbound.list(user, query);
  }

  /** Filtered CSV export — same filters as GET /inbound-orders (must be before :id). */
  @Get('export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrders(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListInboundQueryDto,
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
    return this.inbound.findById(id, user);
  }

  @Patch(':id/plan')
  updatePlan(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: UpdateInboundPlanDto,
  ) {
    return this.inbound.updatePlan(user, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.inbound.approveAdmin(user, id);
  }

  @Post(':id/complete-receiving')
  completeReceiving(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.completeReceivingAdmin(user, id);
  }

  @Post(':id/complete-putaway')
  completePutaway(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.completePutawayAdmin(user, id);
  }

  /** @deprecated Prefer stage endpoints; advances exactly one Admin stage. */
  @Post(':id/execute-admin')
  executeAdmin(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.executeAdmin(user, id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: ConfirmInboundBodyDto,
  ) {
    return this.inbound.confirm(user, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.cancel(id, user);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.remove(id, user);
  }

  @Post(':id/lines/:lineId/receive')
  receive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: ReceiveLineDto,
  ) {
    return this.inbound.receiveLine(user, id, lineId, dto);
  }
}
