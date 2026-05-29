import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { Public } from '../../common/auth/public.decorator';
import { ObservabilityService } from './observability.service';
import { OpsPolicyConfig } from './ops-policy.config';
import { OpsProbeGuard } from './ops-probe.guard';

/**
 * Operational endpoints under `/api/ops/*`.
 *
 * - `health/live` — minimal public liveness (or 404 when disabled)
 * - `health/ready` — readiness; sanitized in production unless `OPS_READY_VERBOSE=true`
 * - `diagnostics` — internal admin only; disabled in production unless explicitly enabled
 */
@Controller('ops')
export class ObservabilityController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly policy: OpsPolicyConfig,
  ) {}

  @Public()
  @Get('health/live')
  live() {
    this.observability.assertLivenessEnabled();
    return this.observability.live();
  }

  @Public()
  @UseGuards(OpsProbeGuard)
  @Get('health/ready')
  async ready() {
    this.observability.assertReadinessEnabled();
    return this.observability.ready();
  }

  @Get('diagnostics')
  @UseGuards(InternalAdminGuard)
  diagnostics(@Req() req: Request) {
    this.observability.assertDiagnosticsEnabled();
    return this.observability.diagnostics(req);
  }

  /** Policy snapshot for operators (no process/memory leak). */
  @Get('policy')
  @UseGuards(InternalAdminGuard)
  getPolicy() {
    return this.policy.snapshot();
  }
}
