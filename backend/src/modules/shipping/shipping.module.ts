import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
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
import { MockCarrierAdapter } from './providers/mock-carrier/mock-carrier.adapter';
import { SenaExpressAdapter } from './providers/sena-express/sena-express.adapter';
import { SenaExpressHttpClient } from './providers/sena-express/sena-express.http-client';
import { SilaSyAdapter } from './providers/sila-sy/sila-sy.adapter';
import { SilaSyHttpClient } from './providers/sila-sy/sila-sy.http-client';
import { ShippingController } from './shipping.controller';
import { ShippingFeeController } from './shipping-fee.controller';
import { ShippingFeeService } from './shipping-fee.service';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { ShippingGeoService } from './shipping-geo.service';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingFxService } from './shipping-fx.service';
import { ShippingService } from './shipping.service';
import { ShippingAutoReturnService } from './shipping-auto-return.service';
import { ShippingTrackingService } from './shipping-tracking.service';
import { ShippingSyncScheduler } from './shipping-sync.scheduler';
import { SilaEventSyncService } from './sila-event-sync.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CryptoModule,
    AuthModule,
    RealtimeModule,
    InventoryModule,
    CodModule,
  ],
  controllers: [ShippingController, ShippingWebhookController, ShippingFeeController],
  providers: [
    BabelExpressHttpClient,
    BabelExpressAdapter,
    BabelAddressAdapter,
    BabelGeoSyncService,
    SenaExpressHttpClient,
    SenaExpressAdapter,
    SilaSyHttpClient,
    SilaSyAdapter,
    MockCarrierAdapter,
    AddressResolveService,
    ShippingFxService,
    ShippingProviderRegistry,
    ShippingGeoService,
    ShippingService,
    BulkShippingService,
    ShippingAutoReturnService,
    ShippingTrackingService,
    SilaEventSyncService,
    ShippingSyncScheduler,
    ShippingFeeService,
  ],
  exports: [
    ShippingFxService,
    ShippingService,
    ShippingProviderRegistry,
    BulkShippingService,
    ShippingGeoService,
    BabelGeoSyncService,
    BabelExpressAdapter,
    BabelAddressAdapter,
    SenaExpressAdapter,
    SilaSyAdapter,
    AddressResolveService,
    ShippingAutoReturnService,
    ShippingTrackingService,
    ShippingFeeService,
  ],
})
export class ShippingModule {}
