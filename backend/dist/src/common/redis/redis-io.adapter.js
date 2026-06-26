"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    nestApp;
    log = new common_1.Logger(RedisIoAdapter.name);
    adapterConstructor = null;
    constructor(nestApp) {
        super(nestApp);
        this.nestApp = nestApp;
    }
    async connectToRedis() {
        const config = this.nestApp.get(config_1.ConfigService);
        const explicitOff = config.get('REDIS_ENABLED')?.trim().toLowerCase() === 'false';
        if (explicitOff) {
            this.log.warn('Redis disabled — Socket.IO runs in-process only (PM2 cluster requires REDIS_ENABLED).');
            return;
        }
        const host = config.get('REDIS_HOST') ?? '127.0.0.1';
        const port = Number(config.get('REDIS_PORT') ?? 6379);
        const password = config.get('REDIS_PASSWORD')?.trim() || undefined;
        const db = Number(config.get('REDIS_DB') ?? 0);
        const keyPrefix = (config.get('REDIS_KEY_PREFIX') ?? 'wms:').trim();
        const pubClient = new ioredis_1.default({
            host,
            port,
            password,
            db,
            keyPrefix,
            maxRetriesPerRequest: 2,
            lazyConnect: true,
            connectTimeout: 5_000,
        });
        const subClient = pubClient.duplicate();
        try {
            await pubClient.connect();
            await subClient.connect();
        }
        catch (err) {
            this.log.warn(`Redis unavailable for Socket.IO adapter (${err.message}) — cluster broadcasts disabled until Redis is up.`);
            pubClient.disconnect();
            subClient.disconnect();
            return;
        }
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
        this.log.log('Socket.IO Redis adapter connected for cluster mode.');
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map