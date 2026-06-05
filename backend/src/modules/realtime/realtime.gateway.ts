import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  authenticateSocketConnection,
  companyRoomName,
  INTERNAL_MASTER_DATA_ROOM,
  normalizeCompanyId,
  userRoomName,
} from './realtime-socket-auth';
import type { SocketPrincipal } from './realtime-socket-auth';
import { RealtimeService } from './realtime.service';
import { PresenceService } from './presence.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly realtime: RealtimeService,
    private readonly presence: PresenceService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
    this.log.log('Realtime Socket.IO gateway ready at namespace /realtime');
  }

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
    const handshakeCompanyIdRaw =
      typeof auth?.companyId === 'string' ? auth.companyId.trim() : undefined;

    if (!token) {
      this.log.warn('Socket connection rejected: missing auth.token');
      client.disconnect(true);
      return;
    }

    const principal = await authenticateSocketConnection(this.config, this.prisma, token);
    if (!principal) {
      this.log.warn('Socket connection rejected: invalid JWT or inactive user');
      client.disconnect(true);
      return;
    }

    (client.data as { principal?: SocketPrincipal }).principal = principal;

    if (principal.kind === 'client') {
      const requestedCompanyId = normalizeCompanyId(handshakeCompanyIdRaw);
      if (requestedCompanyId && requestedCompanyId !== principal.companyId.toLowerCase()) {
        this.log.warn('Client socket rejected: auth.companyId does not match token tenant.');
        client.disconnect(true);
        return;
      }
      client.join(companyRoomName(principal.companyId));
      client.join(userRoomName(principal.userId));
      (client.data as { roomCompanyId?: string }).roomCompanyId = principal.companyId;
      this.presence.handleConnect(client, principal);
      this.log.debug(
        `Client socket ${client.id} joined ${companyRoomName(principal.companyId)}`,
      );
      return;
    }

    let tenantScope: Awaited<
      ReturnType<CompanyAccessService['resolvePrincipalTenant']>
    > | null = null;
    try {
      tenantScope = await this.companyAccess.resolvePrincipalTenant(
        principal.userId,
        principal.role,
        handshakeCompanyIdRaw ?? null,
      );
    } catch {
      this.log.warn(
        `Internal socket ${client.id} rejected: invalid or unauthorized auth.companyId.`,
      );
      client.disconnect(true);
      return;
    }

    if (!tenantScope.activeCompanyId) {
      this.log.warn(
        `Internal socket ${client.id} rejected: provide auth.companyId for an authorized tenant.`,
      );
      client.disconnect(true);
      return;
    }

    client.join(companyRoomName(tenantScope.activeCompanyId));
    client.join(INTERNAL_MASTER_DATA_ROOM);
    client.join(userRoomName(principal.userId));
    (client.data as { roomCompanyId?: string }).roomCompanyId = tenantScope.activeCompanyId;
    this.presence.handleConnect(client, principal);
    this.log.debug(
      `Internal socket ${client.id} joined ${companyRoomName(tenantScope.activeCompanyId)} and ${INTERNAL_MASTER_DATA_ROOM}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.presence.handleDisconnect(client);
    const p = (client.data as { principal?: SocketPrincipal }).principal;
    this.log.debug(`Socket disconnected ${client.id} (${p?.kind ?? '?'})`);
  }
}
