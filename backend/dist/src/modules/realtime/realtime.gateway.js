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
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_socket_auth_1 = require("./realtime-socket-auth");
const realtime_service_1 = require("./realtime.service");
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    config;
    prisma;
    companyAccess;
    realtime;
    log = new common_1.Logger(RealtimeGateway_1.name);
    server;
    constructor(config, prisma, companyAccess, realtime) {
        this.config = config;
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.realtime = realtime;
    }
    afterInit(server) {
        this.realtime.attachServer(server);
        this.log.log('Realtime Socket.IO gateway ready at namespace /realtime');
    }
    async handleConnection(client) {
        const auth = client.handshake.auth;
        const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
        const handshakeCompanyIdRaw = typeof auth?.companyId === 'string' ? auth.companyId.trim() : undefined;
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
            const requestedCompanyId = (0, realtime_socket_auth_1.normalizeCompanyId)(handshakeCompanyIdRaw);
            if (requestedCompanyId && requestedCompanyId !== principal.companyId.toLowerCase()) {
                this.log.warn('Client socket rejected: auth.companyId does not match token tenant.');
                client.disconnect(true);
                return;
            }
            client.join((0, realtime_socket_auth_1.companyRoomName)(principal.companyId));
            client.data.roomCompanyId = principal.companyId;
            this.log.debug(`Client socket ${client.id} joined ${(0, realtime_socket_auth_1.companyRoomName)(principal.companyId)}`);
            return;
        }
        let tenantScope = null;
        try {
            tenantScope = await this.companyAccess.resolvePrincipalTenant(principal.userId, principal.role, handshakeCompanyIdRaw ?? null);
        }
        catch {
            this.log.warn(`Internal socket ${client.id} rejected: invalid or unauthorized auth.companyId.`);
            client.disconnect(true);
            return;
        }
        if (!tenantScope.activeCompanyId) {
            this.log.warn(`Internal socket ${client.id} rejected: provide auth.companyId for an authorized tenant.`);
            client.disconnect(true);
            return;
        }
        client.join((0, realtime_socket_auth_1.companyRoomName)(tenantScope.activeCompanyId));
        client.data.roomCompanyId = tenantScope.activeCompanyId;
        this.log.debug(`Internal socket ${client.id} joined ${(0, realtime_socket_auth_1.companyRoomName)(tenantScope.activeCompanyId)}`);
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
        company_access_service_1.CompanyAccessService,
        realtime_service_1.RealtimeService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map