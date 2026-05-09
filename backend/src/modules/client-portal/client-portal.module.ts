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
import { ClientStockController } from './stock/client-stock.controller';
import { ClientStockService } from './stock/client-stock.service';

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
  ],
  controllers: [
    ClientAuthController,
    ClientStockController,
    ClientProductsController,
    ClientInboundOrdersController,
    ClientOutboundOrdersController,
  ],
  providers: [
    ClientAuthService,
    ClientStockService,
    ClientProductsService,
    ClientInboundOrdersService,
    ClientOutboundOrdersService,
    JwtClientStrategy,
    JwtClientAuthGuard,
  ],
  exports: [ClientAuthService],
})
export class ClientPortalModule {}
