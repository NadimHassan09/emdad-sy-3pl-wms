import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InboundModule } from '../inbound/inbound.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboundModule } from '../outbound/outbound.module';
import { ProductsModule } from '../products/products.module';
import { BillingModule } from '../billing/billing.module';
import { ClientAuthController } from './auth/client-auth.controller';
import { ClientAuthService } from './auth/client-auth.service';
import { JwtClientAuthGuard } from './auth/jwt-client-auth.guard';
import { JwtClientStrategy } from './auth/strategies/jwt-client.strategy';
import { ClientInboundOrdersController } from './inbound/client-inbound-orders.controller';
import { ClientInboundOrdersService } from './inbound/client-inbound-orders.service';
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
    InboundModule,
    OutboundModule,
    BillingModule,
  ],
  controllers: [
    ClientAuthController,
    ClientStockController,
    ClientProductsController,
    ClientInboundOrdersController,
    ClientOutboundOrdersController,
    ClientNotificationsController,
    ClientBillingController,
    ClientDashboardController,
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
    JwtClientStrategy,
    JwtClientAuthGuard,
  ],
  exports: [ClientAuthService],
})
export class ClientPortalModule {}
