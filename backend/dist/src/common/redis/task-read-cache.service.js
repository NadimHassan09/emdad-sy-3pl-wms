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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskReadCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("./redis.service");
let TaskReadCacheService = class TaskReadCacheService {
    redis;
    config;
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
    }
    isEnabled() {
        return (this.redis.isEnabled() &&
            this.config.get('TASK_READ_CACHE')?.trim().toLowerCase() === 'true');
    }
    ttlSec() {
        const raw = this.config.get('TASK_READ_CACHE_TTL_SEC');
        const n = raw != null && raw !== '' ? Number(raw) : 45;
        return Number.isFinite(n) && n > 0 ? Math.min(n, 300) : 45;
    }
    cacheKey(companyKey, taskId) {
        return `tasks:v1:detail:${companyKey}:${taskId}`;
    }
    async getOrLoad(companyKey, taskId, load) {
        if (!this.isEnabled()) {
            return load();
        }
        return this.redis.getOrSet(this.cacheKey(companyKey, taskId), this.ttlSec(), load);
    }
};
exports.TaskReadCacheService = TaskReadCacheService;
exports.TaskReadCacheService = TaskReadCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        config_1.ConfigService])
], TaskReadCacheService);
//# sourceMappingURL=task-read-cache.service.js.map