import { Controller, Delete, Get, Query, Redirect, UseGuards } from '@nestjs/common';

import type { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientSheetsGoogleService } from './client-sheets-google.service';

@Controller('client/sheets/google')
export class ClientSheetsGoogleController {
  constructor(private readonly svc: ClientSheetsGoogleService) {}

  /** Step 1 — get the Google consent URL and redirect there. */
  @UseGuards(JwtClientAuthGuard)
  @Get('authorize')
  async authorize(@ClientUser() client: ClientPrincipal) {
    const url = await this.svc.getAuthorizeUrl(client.id);
    return { url };
  }

  /** Step 2 — Google redirects here with ?code=&state=. No JWT guard: callback is public. */
  @Get('callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error?: string) {
    if (error || !code) {
      return { url: `/client/sheets?google_error=${encodeURIComponent(error ?? 'access_denied')}` };
    }
    try {
      await this.svc.handleCallback(code, state);
      return { url: '/client/sheets?google_connected=1' };
    } catch {
      return { url: '/client/sheets?google_error=callback_failed' };
    }
  }

  /** Returns current connection status (connected, sheetId, sheetUrl). */
  @UseGuards(JwtClientAuthGuard)
  @Get('status')
  status(@ClientUser() client: ClientPrincipal) {
    return this.svc.getStatus(client.id);
  }

  /** Creates a fresh Google Sheet and returns its URL. */
  @UseGuards(JwtClientAuthGuard)
  @Get('create-sheet')
  createSheet(@ClientUser() client: ClientPrincipal) {
    return this.svc.createSheet(client);
  }

  /** Disconnects Google Sheets for the calling user. */
  @UseGuards(JwtClientAuthGuard)
  @Delete('disconnect')
  disconnect(@ClientUser() client: ClientPrincipal) {
    return this.svc.disconnect(client.id);
  }
}
