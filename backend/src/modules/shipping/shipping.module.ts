import { Module } from '@nestjs/common';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BulkShippingService } from './bulk-shipping.service';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BabelExpressHttpClient } from './providers/babel-express/babel-express.http-client';
import { ShippingController } from './shipping.controller';
import { ShippingGeoService } from './shipping-geo.service';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingService } from './shipping.service';

@Module({
  imports: [PrismaModule, CryptoModule, AuthModule, RealtimeModule],
  controllers: [ShippingController],
  providers: [
    BabelExpressHttpClient,
    BabelExpressAdapter,
    ShippingProviderRegistry,
    ShippingGeoService,
    ShippingService,
    BulkShippingService,
  ],
  exports: [ShippingService, ShippingProviderRegistry, BulkShippingService, ShippingGeoService],
})
export class ShippingModule {}
