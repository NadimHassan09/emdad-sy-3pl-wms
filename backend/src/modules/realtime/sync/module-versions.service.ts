import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../../common/redis/redis.service';
import type { AppModuleId } from './app-modules';

/**
 * Module Versions = freshness truth (Architecture 2.2).
 * Client Domain: per-company hash. Admin Domain: global hash.
 * In-memory fallback when Redis is disabled (single-process / degraded).
 */
@Injectable()
export class ModuleVersionsService {
  private readonly log = new Logger(ModuleVersionsService.name);
  private readonly memAdmin = new Map<string, number>();
  private readonly memClient = new Map<string, Map<string, number>>();
  private memAdminSeq = 0;
  private memClientSeq = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  async bumpAdmin(modules: AppModuleId[]): Promise<{ sequence: number; modules: AppModuleId[] }> {
    const unique = [...new Set(modules)];
    if (unique.length === 0) {
      return { sequence: await this.nextAdminSequence(), modules: [] };
    }
    if (this.redis.isEnabled()) {
      for (const m of unique) {
        await this.redis.hincrby('realtime:admin:moduleVersions', m, 1);
      }
      const sequence = await this.redis.incr('realtime:admin:sequence');
      return { sequence: sequence || Date.now(), modules: unique };
    }
    for (const m of unique) {
      this.memAdmin.set(m, (this.memAdmin.get(m) ?? 0) + 1);
    }
    this.memAdminSeq += 1;
    return { sequence: this.memAdminSeq, modules: unique };
  }

  async bumpClient(
    companyId: string,
    modules: AppModuleId[],
  ): Promise<{ sequence: number; modules: AppModuleId[] }> {
    const unique = [...new Set(modules)];
    if (unique.length === 0 || !companyId) {
      return { sequence: 0, modules: [] };
    }
    if (this.redis.isEnabled()) {
      const hashKey = `realtime:client:${companyId}:moduleVersions`;
      for (const m of unique) {
        await this.redis.hincrby(hashKey, m, 1);
      }
      const sequence = await this.redis.incr(`realtime:client:${companyId}:sequence`);
      return { sequence: sequence || Date.now(), modules: unique };
    }
    let map = this.memClient.get(companyId);
    if (!map) {
      map = new Map();
      this.memClient.set(companyId, map);
    }
    for (const m of unique) {
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    const seq = (this.memClientSeq.get(companyId) ?? 0) + 1;
    this.memClientSeq.set(companyId, seq);
    return { sequence: seq, modules: unique };
  }

  async snapshotAdmin(): Promise<{ sequence: number; moduleVersions: Record<string, number> }> {
    if (this.redis.isEnabled()) {
      const raw = await this.redis.hgetall('realtime:admin:moduleVersions');
      const moduleVersions: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        moduleVersions[k] = Number(v) || 0;
      }
      const seqRaw = await this.redis.getString('realtime:admin:sequence');
      return { sequence: Number(seqRaw) || 0, moduleVersions };
    }
    return {
      sequence: this.memAdminSeq,
      moduleVersions: Object.fromEntries(this.memAdmin),
    };
  }

  async snapshotClient(
    companyId: string,
  ): Promise<{ sequence: number; moduleVersions: Record<string, number> }> {
    if (!companyId) return { sequence: 0, moduleVersions: {} };
    if (this.redis.isEnabled()) {
      const raw = await this.redis.hgetall(`realtime:client:${companyId}:moduleVersions`);
      const moduleVersions: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        moduleVersions[k] = Number(v) || 0;
      }
      const seqRaw = await this.redis.getString(`realtime:client:${companyId}:sequence`);
      return { sequence: Number(seqRaw) || 0, moduleVersions };
    }
    const map = this.memClient.get(companyId);
    return {
      sequence: this.memClientSeq.get(companyId) ?? 0,
      moduleVersions: map ? Object.fromEntries(map) : {},
    };
  }

  private async nextAdminSequence(): Promise<number> {
    if (this.redis.isEnabled()) {
      return (await this.redis.incr('realtime:admin:sequence')) || Date.now();
    }
    this.memAdminSeq += 1;
    return this.memAdminSeq;
  }
}
