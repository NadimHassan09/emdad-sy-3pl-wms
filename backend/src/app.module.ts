import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { LifecycleModule } from './common/lifecycle/lifecycle.module';
import { CronLeaderModule } from './common/cron/cron-leader.module';
import { validateEnv } from './common/config/env.validation';
import { CompanyAccessModule } from './common/company-access/company-access.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { SecurityModule } from './common/security/security.module';
import { AdjustmentsModule } from './modules/adjustments/adjustments.module';
import { CycleCountModule } from './modules/cycle-count/cycle-count.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { BackupsModule } from './modules/backups/backups.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { BillingModule } from './modules/billing/billing.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { WarehouseWorkflowModule } from './modules/warehouse-workflow/warehouse-workflow.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FormsModule } from './modules/forms/forms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
      expandVariables: true,
    }),
    LifecycleModule,
    CronLeaderModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 120,
        },
      ],
    }),
    CompanyAccessModule,
    CryptoModule,
    SecurityModule,
    AuthModule,
    PrismaModule,
    RedisModule,
    NotificationsModule,
    CompaniesModule,
    BillingModule,
    DashboardModule,
    ClientPortalModule,
    UsersModule,
    ProductsModule,
    WarehousesModule,
    LocationsModule,
    InventoryModule,
    ObservabilityModule,
    InboundModule,
    OutboundModule,
    ReturnsModule,
    AdjustmentsModule,
    CycleCountModule,
    AuditLogsModule,
    BackupsModule,
    WarehouseWorkflowModule,
    RealtimeModule,
    ReportsModule,
    FormsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
