"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RealtimeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const websockets_1 = require("@nestjs/websockets");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_socket_auth_1 = require("./realtime-socket-auth");
const realtime_service_1 = require("./realtime.service");
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    config;
    prisma;
    realtime;
    log = new common_1.Logger(RealtimeGateway_1.name);
    server;
    constructor(config, prisma, realtime) {
        this.config = config;
        this.prisma = prisma;
        this.realtime = realtime;
    }
    afterInit(server) {
        this.realtime.attachServer(server);
        this.log.log('Realtime Socket.IO gateway ready at namespace /realtime');
    }
    async handleConnection(client) {
        const auth = client.handshake.auth;
        const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
        const handshakeCompanyId = typeof auth?.companyId === 'string' ? auth.companyId.trim() : undefined;
        if (!token) {
            this.log.warn('Socket connection rejected: missing auth.token');
            client.disconnect(true);
            return;
        }
        const principal = await (0, realtime_socket_auth_1.authenticateSocketConnection)(this.config, this.prisma, token);
        if (!principal) {
            this.log.warn('Socket connection rejected: invalid JWT or inactive user');
            client.disconnect(true);
            return;
        }
        client.data.principal = principal;
        if (principal.kind === 'client') {
            if (handshakeCompanyId &&
                handshakeCompanyId.toLowerCase() !== principal.companyId.toLowerCase()) {
                this.log.warn('Client socket rejected: auth.companyId does not match token tenant.');
                client.disconnect(true);
                return;
            }
            client.join(`company:${principal.companyId}`);
            this.log.debug(`Client socket ${client.id} joined company:${principal.companyId}`);
            return;
        }
        if (!(0, realtime_socket_auth_1.isValidCompanyRoomId)(handshakeCompanyId)) {
            this.log.warn(`Internal socket ${client.id} rejected: provide auth.companyId (UUID) matching your active tenant.`);
            client.disconnect(true);
            return;
        }
        client.join(`company:${handshakeCompanyId}`);
        this.log.debug(`Internal socket ${client.id} joined company:${handshakeCompanyId}`);
    }
    handleDisconnect(client) {
        const p = client.data.principal;
        this.log.debug(`Socket disconnected ${client.id} (${p?.kind ?? '?'})`);
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], RealtimeGateway.prototype, "server", void 0);
exports.RealtimeGateway = RealtimeGateway = RealtimeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/realtime',
        cors: { origin: true, credentials: true },
    }),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map