import { Module } from '@nestjs/common';

import { FinalContractsController } from './final-contracts.controller';
import { FinalContractsService } from './final-contracts.service';

@Module({
  controllers: [FinalContractsController],
  providers: [FinalContractsService],
  exports: [FinalContractsService],
})
export class FinalContractsModule {}
