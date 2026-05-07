import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ClientAuthController } from './auth/client-auth.controller';
import { ClientAuthService } from './auth/client-auth.service';
import { JwtClientAuthGuard } from './auth/jwt-client-auth.guard';
import { JwtClientStrategy } from './auth/strategies/jwt-client.strategy';
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
  ],
  controllers: [ClientAuthController, ClientStockController],
  providers: [ClientAuthService, ClientStockService, JwtClientStrategy, JwtClientAuthGuard],
  exports: [ClientAuthService],
})
export class ClientPortalModule {}
