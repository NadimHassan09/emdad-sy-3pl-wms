import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { CreateOmsReturnDto } from '../../oms-returns/dto/oms-return.dto';
import { ListOmsReturnsQueryDto } from '../../oms-returns/oms-returns.service';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOmsReturnsService } from './client-oms-returns.service';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/oms/returns')
export class ClientOmsReturnsController {
  constructor(private readonly returns: ClientOmsReturnsService) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListOmsReturnsQueryDto) {
    return this.returns.list(client, query);
  }

  /** Must stay above `:id` so "export" is not parsed as a UUID. */
  @Get('export')
  @Header('Cache-Control', 'no-store')
  async export(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ListOmsReturnsQueryDto,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    if (String(format ?? 'xlsx').toLowerCase() === 'csv') {
      const result = await this.returns.exportCsv(client, query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.body);
    }
    const result = await this.returns.exportXlsx(client, query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }

  @Get(':id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateOmsReturnDto) {
    return this.returns.create(client, body);
  }
}
