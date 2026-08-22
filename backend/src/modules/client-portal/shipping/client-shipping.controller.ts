import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { ShippingProviderConnectionStatus } from '@prisma/client';

import { Public } from '../../../common/auth/public.decorator';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BabelExpressAdapter } from '../../shipping/providers/babel-express/babel-express.adapter';
import { AddressResolveService } from '../../shipping/address-resolve.service';
import { BABEL_EXPRESS_CODE } from '../../shipping/shipping.constants';
import { ShippingService } from '../../shipping/shipping.service';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ResolveAddressFromPinDto } from '../../shipping/dto/resolve-address-from-pin.dto';

class ResolveBabelNeighbourhoodDto {
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}

/**
 * Client JWT is not an admin JWT. `@Public()` opts out of the global JwtAuthGuard so
 * JwtClientAuthGuard can authenticate the client session (same pattern as other client controllers).
 */
@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/shipping')
export class ClientShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly babelAdapter: BabelExpressAdapter,
    private readonly addressResolve: AddressResolveService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

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
      return { found: false as const, geometry: null, bbox: null };
    }
    return { found: true as const, ...row };
  }

  /**
   * Map pin → nearest local hierarchy address within 1 km (auto-fill address fields).
   * Path is under /api/client/shipping/... (client axios base already includes /api/client).
   */
  @Post('address/resolve-from-pin')
  resolveAddressFromPin(@Body() body: ResolveAddressFromPinDto) {
    return this.addressResolve.resolveFromPin(body.lat, body.lng);
  }

  /** Optional map helper: resolve pin to Babel neighbourhood id when Babel is connected. */
  @Post('babel/resolve-neighbourhood')
  async resolveNeighbourhood(@Body() body: ResolveBabelNeighbourhoodDto) {
    try {
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
    } catch {
      return { found: false as const, neighbourhood: null };
    }
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
