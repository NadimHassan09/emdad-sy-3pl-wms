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
var ModuleVersionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleVersionsService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../../common/redis/redis.service");
let ModuleVersionsService = ModuleVersionsService_1 = class ModuleVersionsService {
    redis;
    log = new common_1.Logger(ModuleVersionsService_1.name);
    memAdmin = new Map();
    memClient = new Map();
    memAdminSeq = 0;
    memClientSeq = new Map();
    constructor(redis) {
        this.redis = redis;
    }
    async bumpAdmin(modules) {
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
    async bumpClient(companyId, modules) {
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
    async snapshotAdmin() {
        if (this.redis.isEnabled()) {
            const raw = await this.redis.hgetall('realtime:admin:moduleVersions');
            const moduleVersions = {};
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
    async snapshotClient(companyId) {
        if (!companyId)
            return { sequence: 0, moduleVersions: {} };
        if (this.redis.isEnabled()) {
            const raw = await this.redis.hgetall(`realtime:client:${companyId}:moduleVersions`);
            const moduleVersions = {};
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
    async nextAdminSequence() {
        if (this.redis.isEnabled()) {
            return (await this.redis.incr('realtime:admin:sequence')) || Date.now();
        }
        this.memAdminSeq += 1;
        return this.memAdminSeq;
    }
};
exports.ModuleVersionsService = ModuleVersionsService;
exports.ModuleVersionsService = ModuleVersionsService = ModuleVersionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], ModuleVersionsService);
//# sourceMappingURL=module-versions.service.js.map