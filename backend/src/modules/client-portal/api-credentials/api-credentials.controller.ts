import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCredentialScope } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ApiDocsService } from '../external-api/api-docs.service';
import { ApiCredentialsService } from './api-credentials.service';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/apis')
export class ApiCredentialsController {
  constructor(
    private readonly credentials: ApiCredentialsService,
    private readonly docs: ApiDocsService,
  ) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal) {
    return this.credentials.list(client);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() dto: CreateApiCredentialDto) {
    return this.credentials.create(client, dto);
  }

  @Get('docs/:scope')
  @Header('Content-Type', 'application/pdf')
  async downloadCanonicalDocs(
    @ClientUser() client: ClientPrincipal,
    @Param('scope') scope: string,
    @Res() res: Response,
  ) {
    if (client.role !== 'client_admin') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only company administrators can download API documentation.' },
      });
      return;
    }
    const parsed = this.parseScope(scope);
    const pdf = await this.docs.render(parsed);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="emdad-${parsed}-api-documentation.pdf"`,
    );
    res.send(pdf);
  }

  @Post(':id/regenerate')
  regenerate(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.credentials.regenerate(client, id);
  }

  @Post(':id/revoke')
  revoke(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.credentials.revoke(client, id);
  }

  @Patch(':id/enabled')
  setEnabled(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: { enabled?: boolean },
  ) {
    return this.credentials.setEnabled(client, id, body.enabled !== false);
  }

  @Get(':id/docs')
  @Header('Content-Type', 'application/pdf')
  async downloadDocsForKey(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Res() res: Response,
  ) {
    const scope = await this.credentials.requireOwnedScope(client, id);
    const pdf = await this.docs.render(scope);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="emdad-${scope}-api-documentation.pdf"`,
    );
    res.send(pdf);
  }

  private parseScope(raw: string): ApiCredentialScope {
    const s = raw.trim().toLowerCase();
    if (s === 'oms' || s === 'inbound' || s === 'outbound') return s;
    throw new BadRequestException('Unknown API type. Use oms, inbound, or outbound.');
  }
}
