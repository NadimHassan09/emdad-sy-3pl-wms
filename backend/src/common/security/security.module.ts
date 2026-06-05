import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { LoginBruteForceService } from './login-brute-force.service';

@Global()
@Module({
  imports: [AuditModule],
  providers: [LoginBruteForceService],
  exports: [LoginBruteForceService],
})
export class SecurityModule {}
