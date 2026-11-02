import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { ShippingProviderConnectionStatus } from '@prisma/client';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BulkShippingService } from './bulk-shipping.service';
import { AddressResolveService } from './address-resolve.service';
import {
  BulkShippingConfirmDto,
  BulkShippingPreviewDto,
} from './dto/bulk-shipping.dto';
import { ConnectShippingProviderDto } from './dto/connect-shipping-provider.dto';
import { RegisterShippingWebhookDto } from './dto/register-shipping-webhook.dto';
import { UpsertShippingFxDto } from './dto/upsert-shipping-fx.dto';
import { UpsertShippingOriginAddressDto } from './dto/upsert-shipping-origin-address.dto';
import { QuoteShippingRatesDto } from './dto/quote-shipping-rates.dto';
import { ResolveAddressFromPinDto } from './dto/resolve-address-from-pin.dto';
import { ResolveAddressFromNamesDto } from './dto/resolve-address-from-names.dto';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BabelGeoSyncService } from './providers/babel-express/babel-geo-sync.service';
import { BABEL_EXPRESS_CODE, SENA_EXPRESS_CODE } from './shipping.constants';
import { ShippingFxService } from './shipping-fx.service';
import { ShippingService } from './shipping.service';
import { ShippingFeeService } from './shipping-fee.service';
import { ShippingTrackingService } from './shipping-tracking.service';
import { ShippingProviderRegistry } from './shipping-provider.registry';

const STAGING_WEBHOOK_HOSTS = new Set(['staging-admin.emdadsy.com', 'staging-client.emdadsy.com']);

function assertStagingWebhookUrl(webhookUrl: string, providerCode: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return 'Webhook URL is not valid.';
  }
  if (parsed.protocol !== 'https:') {
    return 'Webhook URL must use HTTPS.';
  }
  if (!STAGING_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return 'Webhook URL must be a staging host (staging-admin.emdadsy.com or staging-client.emdadsy.com).';
  }
  const expectedPath = `/api/shipping/webhooks/${providerCode}`;
  if (parsed.pathname.replace(/\/+$/, '') !== expectedPath) {
    return `Webhook path must be ${expectedPath}.`;
  }
  return null;
}

class ResolveBabelNeighbourhoodDto {
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}

@Controller('shipping')
@UseGuards(RolesGuard, InternalAdminGuard)
@Roles(AuthGroup.ADMIN)
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly fx: ShippingFxService,
    private readonly bulkShipping: BulkShippingService,
    private readonly babelGeo: BabelGeoSyncService,
    private readonly babelAdapter: BabelExpressAdapter,
    private readonly addressResolve: AddressResolveService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly tracking: ShippingTrackingService,
    private readonly registry: ShippingProviderRegistry,
    private readonly fees: ShippingFeeService,
  ) {}

  @Get('orders/:omsOrderId/carrier-costs')
  carrierCosts(@Param('omsOrderId') omsOrderId: string) {
    return this.fees.carrierCostHistoryForOrder(omsOrderId);
  }

  @Get('providers')
  listProviders() {
    return this.shipping.listProviders();
  }

  @Get('fx')
  getFx() {
    return this.fx.getSettings();
  }

  @Put('fx')
  saveFx(@Body() body: UpsertShippingFxDto, @CurrentUser() user: AuthPrincipal) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only a super admin can set the USD/SYP rate.');
    }
    if (body.mode === 'automatic') return this.fx.saveAutomatic(user);
    if (body.manualRate == null) {
      throw new BadRequestException('Enter the manual USD to SYP rate.');
    }
    return this.fx.saveManual(body.manualRate, user);
  }

  @Post('fx/test-source')
  testFxSource(@CurrentUser() user: AuthPrincipal) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only a super admin can test the exchange-rate source.');
    }
    return this.fx.testSource();
  }

  @Get('origin-address')
  getOriginAddress() {
    return this.shipping.getOriginAddress();
  }

  @Put('origin-address')
  saveOriginAddress(
    @Body() body: UpsertShippingOriginAddressDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only a super admin can set the pickup address.');
    }
    return this.shipping.saveOriginAddress(body, user.id);
  }

  @Post('providers/:code/connect')
  connect(
    @Param('code') code: string,
    @Body() body: ConnectShippingProviderDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.shipping.connectProvider(
      code.toUpperCase(),
      body.username,
      body.password,
      user.id,
      body.webhookSecret,
    );
  }

  @Post('providers/:code/test')
  test(@Param('code') code: string) {
    return this.shipping.testProvider(code.toUpperCase());
  }

  @Post('providers/:code/disconnect')
  disconnect(@Param('code') code: string) {
    return this.shipping.disconnectProvider(code.toUpperCase());
  }

  @Get('geo/boundary')
  async getBoundary(
    @Query('governorate') governorate?: string,
    @Query('city') city?: string,
    @Query('neighborhood') neighborhood?: string,
  ) {
    const row = await this.shipping.lookupAreaBoundary({
      governorate,
      city,
      neighborhood,
    });
    if (!row) {
      return { found: false as const, geometry: null };
    }
    return { found: true as const, ...row };
  }

  /** Refreshable Babel geo snapshot (not eternal truth). */
  @Post('babel/geo/sync')
  syncBabelGeo() {
    return this.babelGeo.syncFromBabel();
  }

  @Get('babel/geo/meta')
  babelGeoMeta() {
    return this.babelGeo.snapshotMeta();
  }

  @Get('babel/geo/cities')
  babelCities() {
    return this.babelGeo.listCities();
  }

  @Get('babel/geo/cities/:cityId/areas')
  babelAreas(@Param('cityId') cityId: string) {
    return this.babelGeo.listAreas(Number(cityId));
  }

  @Get('babel/geo/areas/:areaId/neighbourhoods')
  babelNeighbourhoods(@Param('areaId') areaId: string) {
    return this.babelGeo.listNeighbourhoods(Number(areaId));
  }

  /**
   * Map pin → nearest local hierarchy address within 1 km.
   * Used to auto-fill Governorate / City-Region / Town-Neighborhood.
   */
  @Post('address/resolve-from-pin')
  resolveAddressFromPin(@Body() body: ResolveAddressFromPinDto) {
    return this.addressResolve.resolveFromPin(body.lat, body.lng);
  }

  /** Internal hierarchy names → stored coordinates for carrier shipping. */
  @Post('address/resolve-from-names')
  resolveAddressFromNames(@Body() body: ResolveAddressFromNamesDto) {
    return this.addressResolve.resolveFromAddress({
      governorate: body.governorate,
      cityRegion: body.cityRegion,
      townNeighborhood: body.townNeighborhood,
    });
  }

  /** Map pin → Babel neighbourhood id (optional address helper). */
  @Post('babel/resolve-neighbourhood')
  async resolveNeighbourhood(@Body() body: ResolveBabelNeighbourhoodDto) {
    const credentials = await this.requireBabelCredentials();
    const found = await this.babelAdapter.findNeighbourhoodByCoordinates(
      credentials,
      body.lat,
      body.lng,
    );
    if (!found) {
      return { found: false as const, neighbourhood: null };
    }
    return { found: true as const, neighbourhood: found };
  }

  @Post('rates')
  quoteRates(@Body() body: QuoteShippingRatesDto) {
    return this.shipping.quoteDestinationRates(body);
  }

  @Post('shipments/:outboundOrderId/retry')
  retry(
    @Param('outboundOrderId') outboundOrderId: string,
    @Body() body?: { acknowledgeNoExternalShipment?: boolean },
  ) {
    return this.shipping.retryShipment(outboundOrderId, {
      acknowledgeNoExternalShipment: body?.acknowledgeNoExternalShipment === true,
    });
  }

  @Post('shipments/:outboundOrderId/sync-tracking')
  async syncTracking(@Param('outboundOrderId') outboundOrderId: string) {
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: { outboundOrderId },
      select: { externalAwb: true, providerCode: true },
    });
    if (!shipment || !shipment.externalAwb) {
      return { success: false, message: 'No carrier shipment with an AWB found for this order.' };
    }
    return this.tracking.syncShipmentByAwb(shipment.externalAwb, shipment.providerCode);
  }

  @Post('providers/:providerCode/register-webhook')
  async registerWebhook(
    @Param('providerCode') providerCode: string,
    @Body() body: RegisterShippingWebhookDto,
  ) {
    const code = providerCode.toUpperCase().trim();
    if (code === SENA_EXPRESS_CODE) {
      const secret = body.secret?.trim();
      if (!secret) {
        return { ok: false, message: 'Webhook secret is required.' };
      }
      const connection = await this.prisma.shippingProviderConnection.findFirst({
        where: { provider: { code } },
      });
      if (!connection) {
        return { ok: false, message: `Provider ${code} is not connected.` };
      }
      await this.prisma.shippingProviderConnection.update({
        where: { id: connection.id },
        data: { webhookSecret: secret },
      });
      return {
        ok: true,
        secretSaved: true,
        secretPrefix: `${secret.slice(0, 6)}…`,
        message: 'SENA Express webhook secret saved successfully.',
      };
    }
    const adapter = this.registry.get(code);
    if (!adapter || !adapter.registerWebhook) {
      return { ok: false, message: `Provider ${code} does not support automatic webhook registration.` };
    }
    const webhookUrl = (body.webhookUrl || '').trim();
    const urlError = assertStagingWebhookUrl(webhookUrl, code);
    if (urlError) {
      return { ok: false, message: urlError };
    }
    const connection = await this.prisma.shippingProviderConnection.findFirst({
      where: { provider: { code } },
    });
    if (!connection || connection.status !== 'connected' || !connection.encryptedUsername) {
      return { ok: false, message: `Provider ${code} is not connected.` };
    }
    const credentials = {
      username: this.encryption.decrypt(connection.encryptedUsername),
      password: connection.encryptedPassword ? this.encryption.decrypt(connection.encryptedPassword) : '',
    };
    const requestedSecret = body.secret?.trim() || '';
    const existingSecret = connection.webhookSecret?.trim() || '';
    const registerSecret =
      code === BABEL_EXPRESS_CODE
        ? requestedSecret.length >= 32
          ? requestedSecret
          : existingSecret.length >= 32
            ? existingSecret
            : ''
        : requestedSecret;
    const result = await adapter.registerWebhook(credentials, webhookUrl, registerSecret);
    if (!result.ok) return { ok: false, message: result.message };

    const webhookSecret = result.secret || body.secret?.trim() || '';
    if (webhookSecret) {
      await this.prisma.shippingProviderConnection.update({
        where: { id: connection.id },
        data: { webhookSecret },
      });
    }

    let testPing: { ok: boolean; message?: string } | undefined;
    if (result.webhookId && adapter.testRegisteredWebhook) {
      testPing = await adapter.testRegisteredWebhook(credentials, result.webhookId);
    }

    return {
      ok: true,
      webhookId: result.webhookId,
      secretSaved: Boolean(webhookSecret),
      secretPrefix: webhookSecret ? `${webhookSecret.slice(0, 6)}…` : null,
      testPing,
      message: result.message,
    };
  }

  @Post('shipments/:outboundOrderId/refresh-sila-awb')
  refreshSilaAwb(@Param('outboundOrderId') outboundOrderId: string) {
    return this.tracking.refreshSilaCarrierIdentifiers(outboundOrderId);
  }

  @Get('bulk/eligible')
  listEligible(
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bulkShipping.listEligible({
      companyId: companyId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('bulk/preview')
  preview(@Body() body: BulkShippingPreviewDto) {
    return this.bulkShipping.preview(body.outboundOrderIds);
  }

  @Post('bulk/jobs')
  confirm(
    @Body() body: BulkShippingConfirmDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bulkShipping.confirmAndStart(user.id, body.items);
  }

  @Get('bulk/jobs/:id')
  getJob(@Param('id') id: string) {
    return this.bulkShipping.getJob(id);
  }

  @Post('bulk/jobs/:id/items/:outboundOrderId/retry')
  retryItem(
    @Param('id') id: string,
    @Param('outboundOrderId') outboundOrderId: string,
    @Body() body?: { acknowledgeNoExternalShipment?: boolean },
  ) {
    return this.bulkShipping.retryItem(id, outboundOrderId, {
      acknowledgeNoExternalShipment: body?.acknowledgeNoExternalShipment === true,
    });
  }

  @Get('bulk/jobs/:id/labels')
  getLabels(@Param('id') id: string) {
    return this.bulkShipping.getLabelsForJob(id);
  }

  private async requireBabelCredentials() {
    const provider = await this.prisma.shippingProvider.findUnique({
      where: { code: BABEL_EXPRESS_CODE },
      include: { connection: true },
    });
    const conn = provider?.connection;
    if (
      !conn ||
      conn.status !== ShippingProviderConnectionStatus.connected ||
      !conn.encryptedUsername ||
      !conn.encryptedPassword
    ) {
      throw new Error('Babel Express is not connected.');
    }
    return {
      username: this.encryption.decrypt(conn.encryptedUsername),
      password: this.encryption.decrypt(conn.encryptedPassword),
    };
  }
}
