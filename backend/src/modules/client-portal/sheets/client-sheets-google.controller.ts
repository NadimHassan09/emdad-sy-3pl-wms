import { Controller, Delete, Get, Query, Redirect, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import type { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientSheetsGoogleService } from './client-sheets-google.service';

/**
 * Client Google Sheets — `@Public()` opts out of the global admin JwtAuthGuard so
 * the client cookie/JWT can authenticate via JwtClientAuthGuard instead.
 * Unlinked Google is a normal `{ connected: false }` from status, never 401.
 */
@Public()
@Controller('client/sheets/google')
export class ClientSheetsGoogleController {
  constructor(private readonly svc: ClientSheetsGoogleService) {}

  private sheetsReturnUrl(req: Request, query: string): string {
    const configured = (process.env.CLIENT_PORTAL_ORIGIN ?? process.env.CLIENT_PORTAL_URL)?.replace(/\/$/, '');
    if (configured) return `${configured}/sheets${query}`;
    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https');
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'staging-client.emdadsy.com');
    // API host staging-api.* → client host staging-client.*; otherwise same host SPA.
    const clientHost = host.replace(/^staging-api\./, 'staging-client.').replace(/^api\./, 'client.');
    return `${proto}://${clientHost}/sheets${query}`;
  }

  /** Step 1 — get the Google consent URL and redirect there. */
  @UseGuards(JwtClientAuthGuard)
  @Get('authorize')
  async authorize(@ClientUser() client: ClientPrincipal) {
    const url = await this.svc.getAuthorizeUrl(client.id);
    return { url };
  }

  /** Step 2 — Google redirects here with ?code=&state=. No JWT: callback is public. */
  @Get('callback')
  @Redirect()
  async callback(
    @Req() req: Request,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error || !code) {
      return { url: this.sheetsReturnUrl(req, `?google_error=${encodeURIComponent(error ?? 'access_denied')}`) };
    }
    try {
      await this.svc.handleCallback(code, state);
      return { url: this.sheetsReturnUrl(req, '?google_connected=1') };
    } catch {
      return { url: this.sheetsReturnUrl(req, '?google_error=callback_failed') };
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
