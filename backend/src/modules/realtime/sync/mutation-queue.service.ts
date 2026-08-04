import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server } from 'socket.io';

import {
  companyRoomName,
  INTERNAL_MASTER_DATA_ROOM,
  normalizeCompanyId,
  userRoomName,
} from '../realtime-socket-auth';
import type { AppModuleId } from './app-modules';
import { resolveRegistry } from './module-registry.data';
import { ModuleVersionsService } from './module-versions.service';

export const SYSTEM_VERSION_EVENT = 'system.version';

export type PublishedMutation = {
  mutationId: string;
  companyId?: string | null;
  userId?: string | null;
  enqueuedAt: number;
};

type PendingAudience = {
  modules: Set<AppModuleId>;
  sequence: number;
  timer: ReturnType<typeof setTimeout> | null;
  flush: (sequence: number, modules: AppModuleId[]) => void;
};

/**
 * Mutation Queue: order + merge by domain/audience, then debounce emit traffic.
 * Emits the single sync event `system.version`.
 */
@Injectable()
export class MutationQueueService implements OnModuleDestroy {
  private readonly log = new Logger(MutationQueueService.name);
  private io: Server | null = null;
  private readonly queue: PublishedMutation[] = [];
  private draining = false;
  private readonly mergeWindowMs: number;
  private readonly debounceMs: number;

  /** Pending debounced emits keyed by `admin` | `client:{companyId}` | `user:{userId}` */
  private readonly pending = new Map<string, PendingAudience>();

  constructor(
    private readonly versions: ModuleVersionsService,
    config: ConfigService,
  ) {
    this.mergeWindowMs = Number(config.get<string>('REALTIME_MERGE_WINDOW_MS') ?? 30);
    this.debounceMs = Number(config.get<string>('REALTIME_EMIT_DEBOUNCE_MS') ?? 100);
  }

  attachServer(server: Server): void {
    this.io = server;
  }

  enqueue(item: Omit<PublishedMutation, 'enqueuedAt'>): void {
    this.queue.push({ ...item, enqueuedAt: Date.now() });
    void this.drain();
  }

  onModuleDestroy(): void {
    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer);
    }
    this.pending.clear();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.takeMergeBatch();
        await this.processBatch(batch);
      }
    } catch (err) {
      this.log.warn(
        `Mutation queue drain failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.draining = false;
      if (this.queue.length > 0) void this.drain();
    }
  }

  /** Merge consecutive items within merge window that share company audience affinity. */
  private takeMergeBatch(): PublishedMutation[] {
    const first = this.queue.shift();
    if (!first) return [];
    const batch = [first];
    const deadline = first.enqueuedAt + this.mergeWindowMs;
    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      if (next.enqueuedAt > deadline) break;
      const sameCompany =
        normalizeCompanyId(next.companyId ?? '') === normalizeCompanyId(first.companyId ?? '') ||
        (!first.companyId && !next.companyId);
      if (!sameCompany) break;
      batch.push(this.queue.shift()!);
    }
    return batch;
  }

  private async processBatch(batch: PublishedMutation[]): Promise<void> {
    if (batch.length === 0) return;

    const clientModules = new Set<AppModuleId>();
    const adminModules = new Set<AppModuleId>();
    let companyId: string | null = null;
    const userTargets = new Map<string, Set<AppModuleId>>();

    for (const item of batch) {
      const row = resolveRegistry(item.mutationId);
      if (row.client.length === 0 && row.admin.length === 0) {
        this.log.debug(`No registry row modules for mutation ${item.mutationId}`);
      }
      for (const m of row.client) clientModules.add(m);
      for (const m of row.admin) adminModules.add(m);
      const cid = normalizeCompanyId(item.companyId ?? '');
      if (cid) companyId = cid;

      if (item.userId) {
        const alwaysActive = [...row.client, ...row.admin].filter(
          (m) => m === 'session' || m === 'notifications',
        );
        if (alwaysActive.length > 0) {
          let set = userTargets.get(item.userId);
          if (!set) {
            set = new Set();
            userTargets.set(item.userId, set);
          }
          for (const m of alwaysActive) set.add(m);
        }
      }
    }

    if (companyId && clientModules.size > 0) {
      const bumped = await this.versions.bumpClient(companyId, [...clientModules]);
      if (bumped.modules.length) {
        const cid = companyId;
        this.scheduleEmit(`client:${cid}`, bumped.sequence, bumped.modules, (sequence, modules) =>
          this.emitToCompany(cid, sequence, modules),
        );
      }
    }

    if (adminModules.size > 0) {
      const bumped = await this.versions.bumpAdmin([...adminModules]);
      if (bumped.modules.length) {
        this.scheduleEmit('admin', bumped.sequence, bumped.modules, (sequence, modules) =>
          this.emitToAdmin(sequence, modules),
        );
      }
    }

    for (const [userId, mods] of userTargets) {
      const modules = [...mods];
      // Wire sequence for user-room fan-out (freshness still from domain stores above).
      const sequence = Date.now();
      this.scheduleEmit(`user:${userId}`, sequence, modules, (seq, modsOut) =>
        this.emitToUser(userId, seq, modsOut),
      );
    }
  }

  private scheduleEmit(
    key: string,
    sequence: number,
    modules: AppModuleId[],
    flush: (sequence: number, modules: AppModuleId[]) => void,
  ): void {
    let pending = this.pending.get(key);
    if (!pending) {
      pending = { modules: new Set(), sequence, timer: null, flush };
      this.pending.set(key, pending);
    }
    pending.sequence = sequence;
    pending.flush = flush;
    for (const m of modules) pending.modules.add(m);
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      const current = this.pending.get(key);
      this.pending.delete(key);
      if (!current) return;
      current.flush(current.sequence, [...current.modules]);
    }, this.debounceMs);
  }

  private emitToCompany(companyId: string, version: number, modules: AppModuleId[]): void {
    if (!this.io) return;
    this.io.to(companyRoomName(companyId)).emit(SYSTEM_VERSION_EVENT, { version, modules });
  }

  private emitToAdmin(version: number, modules: AppModuleId[]): void {
    if (!this.io) return;
    this.io.to(INTERNAL_MASTER_DATA_ROOM).emit(SYSTEM_VERSION_EVENT, { version, modules });
  }

  private emitToUser(userId: string, version: number, modules: AppModuleId[]): void {
    if (!this.io) return;
    this.io.to(userRoomName(userId)).emit(SYSTEM_VERSION_EVENT, { version, modules });
  }
}
