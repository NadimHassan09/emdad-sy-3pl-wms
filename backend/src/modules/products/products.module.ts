import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BillingModule } from '../billing/billing.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuditModule, RealtimeModule, BillingModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
