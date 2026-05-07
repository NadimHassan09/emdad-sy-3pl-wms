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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const MAX_PAYLOAD_BYTES = 1_000_000;
let RedisService = RedisService_1 = class RedisService {
    config;
    log = new common_1.Logger(RedisService_1.name);
    client = null;
    disabled;
    keyPrefix;
    constructor(config) {
        this.config = config;
        const explicitOff = this.config.get('REDIS_ENABLED')?.trim().toLowerCase() === 'false';
        this.disabled = explicitOff;
        this.keyPrefix = (this.config.get('REDIS_KEY_PREFIX') ?? 'wms:').trim();
        if (this.disabled) {
            this.log.warn('Redis is disabled via REDIS_ENABLED=false — read caches are bypassed.');
            return;
        }
        const host = this.config.get('REDIS_HOST') ?? '127.0.0.1';
        const port = Number(this.config.get('REDIS_PORT') ?? 6379);
        const password = this.config.get('REDIS_PASSWORD')?.trim() || undefined;
        const db = Number(this.config.get('REDIS_DB') ?? 0);
        this.client = new ioredis_1.default({
            host,
            port,
            password,
            db,
            maxRetriesPerRequest: 2,
            lazyConnect: true,
            enableReadyCheck: true,
            connectTimeout: 5_000,
        });
        this.client.on('error', (err) => {
            this.log.warn(`Redis client error (ops will degrade to DB): ${err.message}`);
        });
    }
    k(key) {
        return `${this.keyPrefix}${key}`;
    }
    isEnabled() {
        return !this.disabled && this.client != null;
    }
    async getJson(key) {
        if (!this.client)
            return null;
        try {
            await this.ensureConnected();
            const raw = await this.client.get(this.k(key));
            if (raw == null)
                return null;
            return JSON.parse(raw);
        }
        catch (e) {
            this.log.debug(`Redis get miss/error for ${key}: ${e.message}`);
            return null;
        }
    }
    async setJson(key, value, ttlSec) {
        if (!this.client)
            return;
        try {
            await this.ensureConnected();
            const raw = JSON.stringify(value);
            if (Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES) {
                this.log.warn(`Skipping Redis SET for "${key}" — payload ${Buffer.byteLength(raw, 'utf8')} bytes exceeds ${MAX_PAYLOAD_BYTES}.`);
                return;
            }
            await this.client.setex(this.k(key), Math.max(1, ttlSec), raw);
        }
        catch (e) {
            this.log.debug(`Redis set error for ${key}: ${e.message}`);
        }
    }
    async del(key) {
        if (!this.client)
            return;
        try {
            await this.ensureConnected();
            await this.client.unlink(this.k(key));
        }
        catch (e) {
            this.log.debug(`Redis unlink error for ${key}: ${e.message}`);
        }
    }
    async deleteByPrefix(prefix) {
        if (!this.client)
            return;
        const pattern = `${this.k(prefix)}*`;
        try {
            await this.ensureConnected();
            let cursor = '0';
            do {
                const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
                cursor = next;
                if (keys.length)
                    await this.client.unlink(...keys);
            } while (cursor !== '0');
        }
        catch (e) {
            this.log.debug(`Redis deleteByPrefix "${prefix}": ${e.message}`);
        }
    }
    async getOrSet(key, ttlSec, fetchFn) {
        if (!this.isEnabled()) {
            return fetchFn();
        }
        try {
            const hit = await this.getJson(key);
            if (hit !== null && hit !== undefined) {
                const marker = hit;
                if (typeof hit === 'object' && marker && marker.__null === true) {
                    return null;
                }
                return hit;
            }
        }
        catch {
            return fetchFn();
        }
        const fresh = await fetchFn();
        if (fresh === undefined) {
            return fresh;
        }
        if (fresh === null) {
            await this.setJson(key, { __null: true }, Math.min(ttlSec, 60));
            return fresh;
        }
        await this.setJson(key, fresh, ttlSec);
        return fresh;
    }
    async ensureConnected() {
        if (!this.client || this.disabled)
            return;
        if (this.client.status === 'wait') {
            await this.client.connect().catch(() => undefined);
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit().catch(() => undefined);
            this.client = null;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map