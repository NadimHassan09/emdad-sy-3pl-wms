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

import { PrismaService } from '../../common/prisma/prisma.service';
import { authenticateSocketConnection, isValidCompanyRoomId } from './realtime-socket-auth';
import type { SocketPrincipal } from './realtime-socket-auth';
import { RealtimeService } from './realtime.service';

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
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
    this.log.log('Realtime Socket.IO gateway ready at namespace /realtime');
  }

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
    const handshakeCompanyId =
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
      if (
        handshakeCompanyId &&
        handshakeCompanyId.toLowerCase() !== principal.companyId.toLowerCase()
      ) {
        this.log.warn('Client socket rejected: auth.companyId does not match token tenant.');
        client.disconnect(true);
        return;
      }
      client.join(`company:${principal.companyId}`);
      this.log.debug(`Client socket ${client.id} joined company:${principal.companyId}`);
      return;
    }

    if (!isValidCompanyRoomId(handshakeCompanyId)) {
      this.log.warn(
        `Internal socket ${client.id} rejected: provide auth.companyId (UUID) matching your active tenant.`,
      );
      client.disconnect(true);
      return;
    }

    client.join(`company:${handshakeCompanyId}`);
    this.log.debug(`Internal socket ${client.id} joined company:${handshakeCompanyId}`);
  }

  handleDisconnect(client: Socket): void {
    const p = (client.data as { principal?: SocketPrincipal }).principal;
    this.log.debug(`Socket disconnected ${client.id} (${p?.kind ?? '?'})`);
  }
}
