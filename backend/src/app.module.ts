import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CryptoModule } from './common/crypto/crypto.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AdjustmentsModule } from './modules/adjustments/adjustments.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LocationsModule } from './modules/locations/locations.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { WarehouseWorkflowModule } from './modules/warehouse-workflow/warehouse-workflow.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CryptoModule,
    AuthModule,
    PrismaModule,
    RedisModule,
    CompaniesModule,
    DashboardModule,
    ClientPortalModule,
    UsersModule,
    ProductsModule,
    WarehousesModule,
    LocationsModule,
    InventoryModule,
    InboundModule,
    OutboundModule,
    AdjustmentsModule,
    WarehouseWorkflowModule,
    RealtimeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
