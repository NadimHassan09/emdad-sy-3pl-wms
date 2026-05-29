import { Module } from '@nestjs/common';

import { ReturnQuantityValidation } from './return-quantity.validation';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnQuantityValidation],
  exports: [ReturnsService],
})
export class ReturnsModule {}
