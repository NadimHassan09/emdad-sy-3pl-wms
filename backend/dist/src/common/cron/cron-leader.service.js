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
var CronLeaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronLeaderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("../redis/redis.service");
function envBool(raw, defaultValue) {
    if (raw === undefined || raw === null || raw === '')
        return defaultValue;
    const v = String(raw).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(v);
}
let CronLeaderService = CronLeaderService_1 = class CronLeaderService {
    redis;
    log = new common_1.Logger(CronLeaderService_1.name);
    enabled;
    constructor(redis, config) {
        this.redis = redis;
        this.enabled = envBool(config.get('CRON_LEADER_ENABLED'), true);
    }
    instanceId() {
        return process.env.NODE_APP_INSTANCE ?? '0';
    }
    isPrimaryInstance() {
        return this.instanceId() === '0';
    }
    async runExclusive(jobKey, ttlSec, fn) {
        if (!this.enabled) {
            return fn();
        }
        const acquired = await this.tryAcquire(jobKey, ttlSec);
        if (!acquired) {
            return undefined;
        }
        try {
            return await fn();
        }
        finally {
            await this.release(jobKey);
        }
    }
    async tryAcquire(jobKey, ttlSec) {
        if (!this.enabled)
            return true;
        if (this.redis.isEnabled()) {
            const token = `${this.instanceId()}:${process.pid}`;
            const ok = await this.redis.setNx(`cron:lock:${jobKey}`, token, ttlSec);
            if (ok)
                return true;
            const current = await this.redis.getString(`cron:lock:${jobKey}`);
            if (current === token) {
                await this.redis.expire(`cron:lock:${jobKey}`, ttlSec);
                return true;
            }
            return false;
        }
        if (!this.isPrimaryInstance()) {
            return false;
        }
        this.log.debug(`Cron leader fallback: Redis disabled — instance ${this.instanceId()} runs "${jobKey}".`);
        return true;
    }
    async release(jobKey) {
        if (!this.redis.isEnabled())
            return;
        const token = `${this.instanceId()}:${process.pid}`;
        const current = await this.redis.getString(`cron:lock:${jobKey}`);
        if (current === token) {
            await this.redis.del(`cron:lock:${jobKey}`);
        }
    }
};
exports.CronLeaderService = CronLeaderService;
exports.CronLeaderService = CronLeaderService = CronLeaderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        config_1.ConfigService])
], CronLeaderService);
//# sourceMappingURL=cron-leader.service.js.map