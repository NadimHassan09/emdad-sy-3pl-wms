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
import { OutboundClientImportService } from '../order-import/outbound-client-import.service';
import { ClientOutboundOrdersService } from './client-outbound-orders.service';
import { ClientListOutboundQueryDto } from './dto/client-list-outbound-query.dto';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/outbound-orders')
export class ClientOutboundOrdersController {
  constructor(
    private readonly outbound: ClientOutboundOrdersService,
    private readonly importSvc: OutboundClientImportService,
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

  @Get(':id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateOutboundOrderDto) {
    return this.outbound.create(client, body);
  }
}
