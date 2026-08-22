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
var MutationQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutationQueueService = exports.SYSTEM_VERSION_EVENT = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const realtime_socket_auth_1 = require("../realtime-socket-auth");
const module_registry_data_1 = require("./module-registry.data");
const module_versions_service_1 = require("./module-versions.service");
exports.SYSTEM_VERSION_EVENT = 'system.version';
let MutationQueueService = MutationQueueService_1 = class MutationQueueService {
    versions;
    log = new common_1.Logger(MutationQueueService_1.name);
    io = null;
    queue = [];
    draining = false;
    mergeWindowMs;
    debounceMs;
    pending = new Map();
    constructor(versions, config) {
        this.versions = versions;
        this.mergeWindowMs = Number(config.get('REALTIME_MERGE_WINDOW_MS') ?? 30);
        this.debounceMs = Number(config.get('REALTIME_EMIT_DEBOUNCE_MS') ?? 100);
    }
    attachServer(server) {
        this.io = server;
    }
    enqueue(item) {
        this.queue.push({ ...item, enqueuedAt: Date.now() });
        void this.drain();
    }
    onModuleDestroy() {
        for (const p of this.pending.values()) {
            if (p.timer)
                clearTimeout(p.timer);
        }
        this.pending.clear();
    }
    async drain() {
        if (this.draining)
            return;
        this.draining = true;
        try {
            while (this.queue.length > 0) {
                const batch = this.takeMergeBatch();
                await this.processBatch(batch);
            }
        }
        catch (err) {
            this.log.warn(`Mutation queue drain failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            this.draining = false;
            if (this.queue.length > 0)
                void this.drain();
        }
    }
    takeMergeBatch() {
        const first = this.queue.shift();
        if (!first)
            return [];
        const batch = [first];
        const deadline = first.enqueuedAt + this.mergeWindowMs;
        while (this.queue.length > 0) {
            const next = this.queue[0];
            if (next.enqueuedAt > deadline)
                break;
            const sameCompany = (0, realtime_socket_auth_1.normalizeCompanyId)(next.companyId ?? '') === (0, realtime_socket_auth_1.normalizeCompanyId)(first.companyId ?? '') ||
                (!first.companyId && !next.companyId);
            if (!sameCompany)
                break;
            batch.push(this.queue.shift());
        }
        return batch;
    }
    async processBatch(batch) {
        if (batch.length === 0)
            return;
        const clientModules = new Set();
        const adminModules = new Set();
        let companyId = null;
        const userTargets = new Map();
        for (const item of batch) {
            const row = (0, module_registry_data_1.resolveRegistry)(item.mutationId);
            if (row.client.length === 0 && row.admin.length === 0) {
                this.log.debug(`No registry row modules for mutation ${item.mutationId}`);
            }
            for (const m of row.client)
                clientModules.add(m);
            for (const m of row.admin)
                adminModules.add(m);
            const cid = (0, realtime_socket_auth_1.normalizeCompanyId)(item.companyId ?? '');
            if (cid)
                companyId = cid;
            if (item.userId) {
                const alwaysActive = [...row.client, ...row.admin].filter((m) => m === 'session' || m === 'notifications');
                if (alwaysActive.length > 0) {
                    let set = userTargets.get(item.userId);
                    if (!set) {
                        set = new Set();
                        userTargets.set(item.userId, set);
                    }
                    for (const m of alwaysActive)
                        set.add(m);
                }
            }
        }
        if (companyId && clientModules.size > 0) {
            const bumped = await this.versions.bumpClient(companyId, [...clientModules]);
            if (bumped.modules.length) {
                const cid = companyId;
                this.scheduleEmit(`client:${cid}`, bumped.sequence, bumped.modules, (sequence, modules) => this.emitToCompany(cid, sequence, modules));
            }
        }
        if (adminModules.size > 0) {
            const bumped = await this.versions.bumpAdmin([...adminModules]);
            if (bumped.modules.length) {
                this.scheduleEmit('admin', bumped.sequence, bumped.modules, (sequence, modules) => this.emitToAdmin(sequence, modules));
            }
        }
        for (const [userId, mods] of userTargets) {
            const modules = [...mods];
            const sequence = Date.now();
            this.scheduleEmit(`user:${userId}`, sequence, modules, (seq, modsOut) => this.emitToUser(userId, seq, modsOut));
        }
    }
    scheduleEmit(key, sequence, modules, flush) {
        let pending = this.pending.get(key);
        if (!pending) {
            pending = { modules: new Set(), sequence, timer: null, flush };
            this.pending.set(key, pending);
        }
        pending.sequence = sequence;
        pending.flush = flush;
        for (const m of modules)
            pending.modules.add(m);
        if (pending.timer)
            clearTimeout(pending.timer);
        pending.timer = setTimeout(() => {
            const current = this.pending.get(key);
            this.pending.delete(key);
            if (!current)
                return;
            current.flush(current.sequence, [...current.modules]);
        }, this.debounceMs);
    }
    emitToCompany(companyId, version, modules) {
        if (!this.io)
            return;
        this.io.to((0, realtime_socket_auth_1.companyRoomName)(companyId)).emit(exports.SYSTEM_VERSION_EVENT, { version, modules });
    }
    emitToAdmin(version, modules) {
        if (!this.io)
            return;
        this.io.to(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM).emit(exports.SYSTEM_VERSION_EVENT, { version, modules });
    }
    emitToUser(userId, version, modules) {
        if (!this.io)
            return;
        this.io.to((0, realtime_socket_auth_1.userRoomName)(userId)).emit(exports.SYSTEM_VERSION_EVENT, { version, modules });
    }
};
exports.MutationQueueService = MutationQueueService;
exports.MutationQueueService = MutationQueueService = MutationQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [module_versions_service_1.ModuleVersionsService,
        config_1.ConfigService])
], MutationQueueService);
//# sourceMappingURL=mutation-queue.service.js.map