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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeVersionController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const presence_service_1 = require("./presence.service");
const module_versions_service_1 = require("./sync/module-versions.service");
const realtime_sync_mode_service_1 = require("./sync/realtime-sync-mode.service");
let RealtimeVersionController = class RealtimeVersionController {
    versions;
    syncMode;
    presence;
    constructor(versions, syncMode, presence) {
        this.versions = versions;
        this.syncMode = syncMode;
        this.presence = presence;
    }
    async getVersion(user, domain, companyId) {
        const mode = this.syncMode.getMode();
        const isClientRole = user.role === 'client_admin' || user.role === 'client_staff';
        const resolvedDomain = domain === 'client' || domain === 'admin'
            ? domain
            : isClientRole
                ? 'client'
                : 'admin';
        if (resolvedDomain === 'client') {
            const cid = (companyId || user.companyId || '').trim();
            const snap = await this.versions.snapshotClient(cid);
            return {
                success: true,
                data: {
                    domain: 'client',
                    companyId: cid || null,
                    version: snap.sequence,
                    moduleVersions: snap.moduleVersions,
                    mode,
                },
            };
        }
        const snap = await this.versions.snapshotAdmin();
        return {
            success: true,
            data: {
                domain: 'admin',
                version: snap.sequence,
                moduleVersions: snap.moduleVersions,
                mode,
            },
        };
    }
    getOnlinePresence(user) {
        const isClient = user.role === 'client_admin' || user.role === 'client_staff';
        if (isClient) {
            return { success: true, data: { userIds: [] } };
        }
        return {
            success: true,
            data: { userIds: this.presence.getOnlineUserIds() },
        };
    }
};
exports.RealtimeVersionController = RealtimeVersionController;
__decorate([
    (0, common_1.Get)('version'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RealtimeVersionController.prototype, "getVersion", null);
__decorate([
    (0, common_1.Get)('presence/online'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RealtimeVersionController.prototype, "getOnlinePresence", null);
exports.RealtimeVersionController = RealtimeVersionController = __decorate([
    (0, common_1.Controller)('realtime'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [module_versions_service_1.ModuleVersionsService,
        realtime_sync_mode_service_1.RealtimeSyncModeService,
        presence_service_1.PresenceService])
], RealtimeVersionController);
//# sourceMappingURL=realtime-version.controller.js.map