import { Module } from '@nestjs/common';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CodModule } from '../cod/cod.module';
import { BulkShippingService } from './bulk-shipping.service';
import { AddressResolveService } from './address-resolve.service';
import { BabelAddressAdapter } from './providers/babel-express/babel-address.adapter';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BabelExpressHttpClient } from './providers/babel-express/babel-express.http-client';
import { BabelGeoSyncService } from './providers/babel-express/babel-geo-sync.service';
import { SilaSyAdapter } from './providers/sila-sy/sila-sy.adapter';
import { SilaSyHttpClient } from './providers/sila-sy/sila-sy.http-client';
import { ShippingController } from './shipping.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { ShippingGeoService } from './shipping-geo.service';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingService } from './shipping.service';
import { ShippingAutoReturnService } from './shipping-auto-return.service';
import { ShippingTrackingService } from './shipping-tracking.service';
import { ShippingSyncScheduler } from './shipping-sync.scheduler';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    AuthModule,
    RealtimeModule,
    InventoryModule,
    CodModule,
  ],
  controllers: [ShippingController, ShippingWebhookController],
  providers: [
    BabelExpressHttpClient,
    BabelExpressAdapter,
    BabelAddressAdapter,
    BabelGeoSyncService,
    SilaSyHttpClient,
    SilaSyAdapter,
    AddressResolveService,
    ShippingProviderRegistry,
    ShippingGeoService,
    ShippingService,
    BulkShippingService,
    ShippingAutoReturnService,
    ShippingTrackingService,
    ShippingSyncScheduler,
  ],
  exports: [
    ShippingService,
    ShippingProviderRegistry,
    BulkShippingService,
    ShippingGeoService,
    BabelGeoSyncService,
    BabelExpressAdapter,
    BabelAddressAdapter,
    SilaSyAdapter,
    AddressResolveService,
    ShippingAutoReturnService,
    ShippingTrackingService,
  ],
})
export class ShippingModule {}
