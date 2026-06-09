import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [AuditModule, RealtimeModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
