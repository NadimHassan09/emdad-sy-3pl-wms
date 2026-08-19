import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InboundModule } from '../inbound/inbound.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MediaModule } from '../media/media.module';
import { OutboundModule } from '../outbound/outbound.module';
import { ProductsModule } from '../products/products.module';
import { BillingModule } from '../billing/billing.module';
import { OmsModule } from '../oms/oms.module';
import { OmsReturnsModule } from '../oms-returns/oms-returns.module';
import { ReturnsModule } from '../returns/returns.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PdfModule } from '../../pdf/pdf.module';
import { ApiCredentialsController } from './api-credentials/api-credentials.controller';
import { ApiCredentialsService } from './api-credentials/api-credentials.service';
import { ApiDocsService } from './external-api/api-docs.service';
import { ApiKeyGuard } from './external-api/api-key.guard';
import { ExternalInboundController } from './external-api/external-inbound.controller';
import { ExternalInboundService } from './external-api/external-inbound.service';
import { ExternalOmsController } from './external-api/external-oms.controller';
import { ExternalOmsService } from './external-api/external-oms.service';
import { ExternalOutboundController } from './external-api/external-outbound.controller';
import { ExternalOutboundService } from './external-api/external-outbound.service';
import { ClientAuthController } from './auth/client-auth.controller';
import { ClientAuthService } from './auth/client-auth.service';
import { JwtClientAuthGuard } from './auth/jwt-client-auth.guard';
import { JwtClientStrategy } from './auth/strategies/jwt-client.strategy';
import { ClientInboundOrdersController } from './inbound/client-inbound-orders.controller';
import { ClientInboundOrdersService } from './inbound/client-inbound-orders.service';
import { ClientMediaController } from './media/client-media.controller';
import { ClientOutboundOrdersController } from './outbound/client-outbound-orders.controller';
import { ClientOutboundOrdersService } from './outbound/client-outbound-orders.service';
import { ClientProductsController } from './products/client-products.controller';
import { ClientProductsService } from './products/client-products.service';
import { ClientNotificationsController } from './notifications/client-notifications.controller';
import { ClientNotificationsService } from './notifications/client-notifications.service';
import { ClientStockController } from './stock/client-stock.controller';
import { ClientStockService } from './stock/client-stock.service';
import { ClientBillingController } from './billing/client-billing.controller';
import { ClientBillingService } from './billing/client-billing.service';
import { ClientDashboardController } from './dashboard/client-dashboard.controller';
import { ClientDashboardService } from './dashboard/client-dashboard.service';
import { ClientOmsOrdersController } from './oms/client-oms-orders.controller';
import { ClientOmsOrdersService } from './oms/client-oms-orders.service';
import { InboundClientImportService } from './order-import/inbound-client-import.service';
import { OmsClientImportService } from './order-import/oms-client-import.service';
import { OutboundClientImportService } from './order-import/outbound-client-import.service';
import { ClientReturnsController } from './returns/client-returns.controller';
import { ClientReturnsService } from './returns/client-returns.service';
import { ClientOmsReturnsController } from './oms-returns/client-oms-returns.controller';
import { ClientOmsReturnsService } from './oms-returns/client-oms-returns.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({}),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('CLIENT_JWT_SECRET') ??
          config.get<string>('JWT_SECRET') ??
          'dev-only-change-in-production',
        signOptions: { expiresIn: 8 * 60 * 60 },
      }),
    }),
    PrismaModule,
    CryptoModule,
    InventoryModule,
    ProductsModule,
    MediaModule,
    InboundModule,
    OutboundModule,
    BillingModule,
    OmsModule,
    OmsReturnsModule,
    ReturnsModule,
    ShippingModule,
    PdfModule,
  ],
  controllers: [
    ClientAuthController,
    ClientStockController,
    ClientProductsController,
    ClientMediaController,
    ClientInboundOrdersController,
    ClientOutboundOrdersController,
    ClientNotificationsController,
    ClientBillingController,
    ClientDashboardController,
    ClientOmsOrdersController,
    ClientOmsReturnsController,
    ClientReturnsController,
    ApiCredentialsController,
    ExternalOmsController,
    ExternalInboundController,
    ExternalOutboundController,
  ],
  providers: [
    ClientAuthService,
    ClientStockService,
    ClientProductsService,
    ClientInboundOrdersService,
    ClientOutboundOrdersService,
    ClientNotificationsService,
    ClientBillingService,
    ClientDashboardService,
    ClientOmsOrdersService,
    OmsClientImportService,
    InboundClientImportService,
    OutboundClientImportService,
    ClientOmsReturnsService,
    ClientReturnsService,
    JwtClientStrategy,
    JwtClientAuthGuard,
    ApiCredentialsService,
    ApiKeyGuard,
    ApiDocsService,
    ExternalOmsService,
    ExternalInboundService,
    ExternalOutboundService,
  ],
  exports: [ClientAuthService],
})
export class ClientPortalModule {}
