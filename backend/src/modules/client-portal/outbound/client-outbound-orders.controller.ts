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

import { CreateOutboundOrderDto } from '../../outbound/dto/create-outbound.dto';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOutboundExportService } from '../order-export/client-outbound-export.service';
import { OutboundClientImportService } from '../order-import/outbound-client-import.service';
import { ClientOutboundOrdersService } from './client-outbound-orders.service';
import { ClientOutboundOrdersExportDto } from './dto/client-outbound-export.dto';
import { ClientListOutboundQueryDto } from './dto/client-list-outbound-query.dto';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/outbound-orders')
export class ClientOutboundOrdersController {
  constructor(
    private readonly outbound: ClientOutboundOrdersService,
    private readonly importSvc: OutboundClientImportService,
    private readonly exportSvc: ClientOutboundExportService,
  ) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ClientListOutboundQueryDto) {
    return this.outbound.list(client, query);
  }

  @Get('import/template')
  @Header('Cache-Control', 'no-store')
  importTemplate(@Res({ passthrough: true }) res: Response) {
    const result = this.importSvc.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.body;
  }

  @Post('import')
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

  @Get('export/columns')
  exportColumns() {
    return this.exportSvc.columns();
  }

  @Post('export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportOrders(
    @ClientUser() client: ClientPrincipal,
    @Body() dto: ClientOutboundOrdersExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.exportSvc.exportCsv(client, dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get(':id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateOutboundOrderDto) {
    return this.outbound.create(client, body);
  }
}
