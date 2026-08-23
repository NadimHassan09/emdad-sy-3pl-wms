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

import { CreateInboundOrderDto } from '../../inbound/dto/create-inbound.dto';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientInboundExportService } from '../order-export/client-inbound-export.service';
import { InboundClientImportService } from '../order-import/inbound-client-import.service';
import { ClientInboundOrdersService } from './client-inbound-orders.service';
import { ClientInboundOrdersExportDto } from './dto/client-inbound-export.dto';
import { ClientListInboundQueryDto } from './dto/client-list-inbound-query.dto';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/inbound-orders')
export class ClientInboundOrdersController {
  constructor(
    private readonly inbound: ClientInboundOrdersService,
    private readonly importSvc: InboundClientImportService,
    private readonly exportSvc: ClientInboundExportService,
  ) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ClientListInboundQueryDto) {
    return this.inbound.list(client, query);
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
    @Body() dto: ClientInboundOrdersExportDto,
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
    return this.inbound.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateInboundOrderDto) {
    return this.inbound.create(client, body);
  }
}
