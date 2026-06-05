import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';

import { RealtimeService } from './realtime.service';
import type { SocketPrincipal } from './realtime-socket-auth';

export type PresenceUserPayload = {
  userId: string;
  role: string;
  companyId: string | null;
  connectedAt: string;
  disconnectedAt?: string;
  email?: string | null;
};

type TrackedSocket = {
  socketId: string;
  principal: SocketPrincipal;
  connectedAt: Date;
};

@Injectable()
export class PresenceService {
  private readonly log = new Logger(PresenceService.name);
  private readonly connections = new Map<string, Set<string>>();
  private readonly socketMeta = new Map<string, TrackedSocket>();

  constructor(private readonly realtime: RealtimeService) {}

  handleConnect(client: Socket, principal: SocketPrincipal): void {
    const userId = principal.userId;
    const set = this.connections.get(userId) ?? new Set<string>();
    const wasOnline = set.size > 0;
    set.add(client.id);
    this.connections.set(userId, set);
    this.socketMeta.set(client.id, {
      socketId: client.id,
      principal,
      connectedAt: new Date(),
    });

    if (!wasOnline) {
      this.realtime.emitPresenceOnline(this.toPresencePayload(principal, new Date()));
      this.realtime.emitDashboardKpiUpdated({
        counters: { activeUsers: this.getOnlineCount() },
      });
      this.log.debug(`User online: ${userId}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const meta = this.socketMeta.get(client.id);
    this.socketMeta.delete(client.id);
    if (!meta) return;

    const userId = meta.principal.userId;
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) {
      this.connections.delete(userId);
      const disconnectedAt = new Date();
      this.realtime.emitPresenceOffline({
        ...this.toPresencePayload(meta.principal, meta.connectedAt),
        disconnectedAt: disconnectedAt.toISOString(),
      });
      this.realtime.emitDashboardKpiUpdated({
        counters: { activeUsers: this.getOnlineCount() },
      });
      this.log.debug(`User offline: ${userId}`);
    } else {
      this.connections.set(userId, set);
    }
  }

  getOnlineCount(): number {
    return this.connections.size;
  }

  getOnlineUserIds(): string[] {
    return [...this.connections.keys()];
  }

  private toPresencePayload(
    principal: SocketPrincipal,
    connectedAt: Date,
  ): PresenceUserPayload {
    return {
      userId: principal.userId,
      role: principal.role,
      companyId: principal.kind === 'client' ? principal.companyId : null,
      connectedAt: connectedAt.toISOString(),
      email: principal.email,
    };
  }
}
