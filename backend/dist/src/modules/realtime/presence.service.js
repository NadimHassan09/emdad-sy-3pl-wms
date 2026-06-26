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
var PresenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const common_1 = require("@nestjs/common");
const realtime_service_1 = require("./realtime.service");
let PresenceService = PresenceService_1 = class PresenceService {
    realtime;
    log = new common_1.Logger(PresenceService_1.name);
    connections = new Map();
    socketMeta = new Map();
    constructor(realtime) {
        this.realtime = realtime;
    }
    handleConnect(client, principal) {
        const userId = principal.userId;
        const set = this.connections.get(userId) ?? new Set();
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
    handleDisconnect(client) {
        const meta = this.socketMeta.get(client.id);
        this.socketMeta.delete(client.id);
        if (!meta)
            return;
        const userId = meta.principal.userId;
        const set = this.connections.get(userId);
        if (!set)
            return;
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
        }
        else {
            this.connections.set(userId, set);
        }
    }
    getOnlineCount() {
        return this.connections.size;
    }
    getOnlineUserIds() {
        return [...this.connections.keys()];
    }
    toPresencePayload(principal, connectedAt) {
        return {
            userId: principal.userId,
            role: principal.role,
            companyId: principal.kind === 'client' ? principal.companyId : null,
            connectedAt: connectedAt.toISOString(),
            email: principal.email,
        };
    }
};
exports.PresenceService = PresenceService;
exports.PresenceService = PresenceService = PresenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService])
], PresenceService);
//# sourceMappingURL=presence.service.js.map