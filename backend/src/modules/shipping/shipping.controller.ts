import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { QuoteShippingRatesDto } from './dto/quote-shipping-rates.dto';
import { ResolveAddressFromPinDto } from './dto/resolve-address-from-pin.dto';
import { ResolveAddressFromNamesDto } from './dto/resolve-address-from-names.dto';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BabelGeoSyncService } from './providers/babel-express/babel-geo-sync.service';
import { BABEL_EXPRESS_CODE } from './shipping.constants';
import { ShippingService } from './shipping.service';

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
    private readonly bulkShipping: BulkShippingService,
    private readonly babelGeo: BabelGeoSyncService,
    private readonly babelAdapter: BabelExpressAdapter,
    private readonly addressResolve: AddressResolveService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  @Get('providers')
  listProviders() {
    return this.shipping.listProviders();
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
  retry(@Param('outboundOrderId') outboundOrderId: string) {
    return this.shipping.retryShipment(outboundOrderId);
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
  ) {
    return this.bulkShipping.retryItem(id, outboundOrderId);
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
