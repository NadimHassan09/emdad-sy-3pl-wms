import { ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import type { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const SHEET_TAB = 'OMS Orders';
const SHEET_HEADERS = [
  'Order #', 'Status', 'Recipient', 'Phone', 'City', 'Required Ship Date',
  'Payment', 'Subtotal (USD)', 'Lines', 'External Ref', 'Created At',
];

@Injectable()
export class ClientSheetsGoogleService {
  private readonly logger = new Logger(ClientSheetsGoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async buildOAuth2Client(): Promise<OAuth2Client> {
    const creds = await this.settings.getDecryptedCredentials();
    if (!creds?.clientId || !creds.clientSecret || !creds.redirectUri) {
      throw new ServiceUnavailableException('Google OAuth is not configured. Ask an admin to set it up in Settings → Google OAuth.');
    }
    return new OAuth2Client(creds.clientId, creds.clientSecret, creds.redirectUri);
  }

  /** Returns the Google consent screen URL the client should be redirected to. */
  async getAuthorizeUrl(userId: string): Promise<string> {
    const client = await this.buildOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SHEETS_SCOPES,
      state: userId,
    });
  }

  /** Exchanges the OAuth code for tokens and stores them. */
  async handleCallback(code: string, state: string): Promise<string> {
    const client = await this.buildOAuth2Client();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new ForbiddenException('Google did not return an access token.');
    }

    const userId = state;
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await this.prisma.clientGoogleToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt,
        scope: tokens.scope ?? null,
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        scope: tokens.scope ?? null,
      },
    });

    return userId;
  }

  /** Returns connection status for the calling user. */
  async getStatus(userId: string): Promise<{ connected: boolean; sheetId: string | null; sheetUrl: string | null }> {
    const token = await this.prisma.clientGoogleToken.findUnique({ where: { userId } });
    if (!token) return { connected: false, sheetId: null, sheetUrl: null };
    return { connected: true, sheetId: token.sheetId, sheetUrl: token.sheetUrl };
  }

  /** Removes stored token (disconnect). */
  async disconnect(userId: string): Promise<void> {
    await this.prisma.clientGoogleToken.deleteMany({ where: { userId } });
  }

  /** Builds a fresh OAuth2 client with valid access token for API calls. */
  async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    const token = await this.prisma.clientGoogleToken.findUnique({ where: { userId } });
    if (!token) throw new NotFoundException('Google Sheets not connected. Please connect first.');

    const oauthClient = await this.buildOAuth2Client();
    oauthClient.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken ?? undefined,
      expiry_date: token.expiresAt.getTime(),
    });

    oauthClient.on('tokens', async (newTokens) => {
      await this.prisma.clientGoogleToken.update({
        where: { userId },
        data: {
          accessToken: newTokens.access_token ?? token.accessToken,
          ...(newTokens.refresh_token ? { refreshToken: newTokens.refresh_token } : {}),
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : token.expiresAt,
        },
      });
    });

    return oauthClient;
  }

  /** Creates a new Google Sheet for the user's orders and stores its id. */
  async createSheet(client: ClientPrincipal): Promise<{ sheetId: string; sheetUrl: string }> {
    const { google } = await import('googleapis');
    const oauthClient = await this.getAuthorizedClient(client.id);
    const sheets = google.sheets({ version: 'v4', auth: oauthClient });

    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: `${client.companyName} — EMDAD Orders` },
        sheets: [{ properties: { title: 'OMS Orders' } }],
      },
    });

    const sheetId = res.data.spreadsheetId!;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;

    await this.prisma.clientGoogleToken.update({
      where: { userId: client.id },
      data: { sheetId, sheetUrl },
    });

    return { sheetId, sheetUrl };
  }

  /**
   * Fire-and-forget sync triggered after an OMS order is created or updated.
   * Finds all users of the company with a linked sheet and refreshes their data.
   */
  syncCompanyOrders(companyId: string): void {
    void (async () => {
      try {
        const tokens = await this.prisma.clientGoogleToken.findMany({
          where: { user: { companyId }, sheetId: { not: null } },
          select: { userId: true, sheetId: true },
        });
        await Promise.allSettled(
          tokens.map((t) => this.syncUserSheet(t.userId, t.sheetId!, companyId)),
        );
      } catch (err) {
        this.logger.error(`syncCompanyOrders failed for company ${companyId}: ${String(err)}`);
      }
    })();
  }

  private async syncUserSheet(userId: string, sheetId: string, companyId: string): Promise<void> {
    const orders = await this.prisma.omsOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        orderNumber: true,
        status: true,
        recipientName: true,
        recipientPhone: true,
        city: true,
        requiredShipDate: true,
        paymentMethod: true,
        subtotal: true,
        externalReference: true,
        clientReference: true,
        createdAt: true,
        lines: { select: { id: true } },
      },
    });

    const rows: string[][] = orders.map((o) => [
      o.orderNumber ?? '',
      o.status,
      o.recipientName ?? '',
      o.recipientPhone ?? '',
      o.city ?? '',
      o.requiredShipDate ? new Date(o.requiredShipDate as unknown as string).toISOString().slice(0, 10) : '',
      o.paymentMethod ?? '',
      o.subtotal != null ? String(o.subtotal) : '',
      String(o.lines.length),
      o.externalReference ?? o.clientReference ?? '',
      o.createdAt.toISOString(),
    ]);

    const values = [SHEET_HEADERS, ...rows];

    try {
      const oauthClient = await this.getAuthorizedClient(userId);
      const { google } = await import('googleapis');
      const sheets = google.sheets({ version: 'v4', auth: oauthClient });

      // Ensure the tab exists (do not throw if it does)
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tabExists = meta.data.sheets?.some(
        (s) => s.properties?.title === SHEET_TAB,
      );
      if (!tabExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
          },
        });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_TAB}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      // Bold the header row
      const sheetMeta2 = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tabId = sheetMeta2.data.sheets?.find((s) => s.properties?.title === SHEET_TAB)?.properties?.sheetId;
      if (tabId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              repeatCell: {
                range: { sheetId: tabId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            }],
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Sheet sync failed for user ${userId}: ${String(err)}`);
    }
  }
}
