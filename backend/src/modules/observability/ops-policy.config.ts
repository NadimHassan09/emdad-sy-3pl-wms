import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function readBool(config: ConfigService, key: string, defaultValue: boolean): boolean {
  const raw = (config.get<string>(key) ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
  return defaultValue;
}

/**
 * Environment-aware operational endpoint policy (Phase 6.4).
 */
@Injectable()
export class OpsPolicyConfig {
  readonly isProduction: boolean;
  /** `GET /ops/health/live` — minimal public liveness. */
  readonly livenessEnabled: boolean;
  /** `GET /ops/health/ready` — dependency readiness. */
  readonly readinessEnabled: boolean;
  /** Include queue/memory/websocket detail payloads (default off in production). */
  readonly readinessVerbose: boolean;
  /** When set in production, `/ready` requires `X-Ops-Probe-Key` or internal-admin JWT. */
  readonly readinessRequiresProbeKey: boolean;
  readonly probeSecret: string | null;
  /** `GET /ops/diagnostics` — default off in production. */
  readonly diagnosticsEnabled: boolean;

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.livenessEnabled = readBool(config, 'OPS_LIVENESS_ENABLED', true);
    this.readinessEnabled = readBool(config, 'OPS_READINESS_ENABLED', true);
    this.probeSecret = (config.get<string>('OPS_PROBE_SECRET') ?? '').trim() || null;
    this.readinessVerbose = readBool(
      config,
      'OPS_READY_VERBOSE',
      !this.isProduction,
    );
    this.readinessRequiresProbeKey =
      this.isProduction && this.probeSecret !== null && this.probeSecret.length >= 16;
    const diagExplicit = config.get<string>('OPS_DIAGNOSTICS_ENABLED');
    if (diagExplicit !== undefined && diagExplicit.trim() !== '') {
      this.diagnosticsEnabled = readBool(config, 'OPS_DIAGNOSTICS_ENABLED', false);
    } else {
      this.diagnosticsEnabled = !this.isProduction;
    }
  }

  snapshot() {
    return {
      livenessEnabled: this.livenessEnabled,
      readinessEnabled: this.readinessEnabled,
      readinessVerbose: this.readinessVerbose,
      readinessRequiresProbeKey: this.readinessRequiresProbeKey,
      diagnosticsEnabled: this.diagnosticsEnabled,
      isProduction: this.isProduction,
    };
  }
}
