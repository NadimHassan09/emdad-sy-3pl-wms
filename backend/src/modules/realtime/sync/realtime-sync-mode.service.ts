import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RealtimeSyncMode = 'legacy' | 'dual' | 'canonical';

@Injectable()
export class RealtimeSyncModeService {
  private readonly log = new Logger(RealtimeSyncModeService.name);
  private readonly mode: RealtimeSyncMode;

  constructor(config: ConfigService) {
    const raw = (config.get<string>('REALTIME_SYNC_MODE') ?? 'dual').trim().toLowerCase();
    if (raw === 'legacy' || raw === 'dual' || raw === 'canonical') {
      this.mode = raw;
    } else {
      this.log.warn(`Invalid REALTIME_SYNC_MODE="${raw}" — defaulting to dual`);
      this.mode = 'dual';
    }
    this.log.log(`Realtime sync mode: ${this.mode}`);
  }

  getMode(): RealtimeSyncMode {
    return this.mode;
  }

  /** Emit Architecture 1.0 feature socket events. */
  emitLegacy(): boolean {
    return this.mode === 'legacy' || this.mode === 'dual';
  }

  /** Publish into Mutation Queue → system.version. */
  emitSystemVersion(): boolean {
    return this.mode === 'dual' || this.mode === 'canonical';
  }
}
