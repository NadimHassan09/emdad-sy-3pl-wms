import { Global, Module } from '@nestjs/common';

import { ApplicationLifecycleService } from './application-lifecycle.service';

@Global()
@Module({
  providers: [ApplicationLifecycleService],
  exports: [ApplicationLifecycleService],
})
export class LifecycleModule {}
