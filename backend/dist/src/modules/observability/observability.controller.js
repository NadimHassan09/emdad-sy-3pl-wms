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
exports.ObservabilityController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const public_decorator_1 = require("../../common/auth/public.decorator");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const redis_service_1 = require("../../common/redis/redis.service");
const realtime_service_1 = require("../realtime/realtime.service");
let ObservabilityController = class ObservabilityController {
    prisma;
    redis;
    realtime;
    config;
    constructor(prisma, redis, realtime, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.realtime = realtime;
        this.config = config;
    }
    live() {
        return {
            status: 'ok',
            service: 'backend',
            timestamp: new Date().toISOString(),
        };
    }
    async ready() {
        const checks = {
            db: 'ok',
            redis: this.redis.isEnabled() ? 'ok' : 'disabled',
            websocket: 'ok',
            process: 'ok',
            queues: 'ok',
        };
        const details = {};
        try {
            await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT 1`);
        }
        catch {
            checks.db = 'error';
        }
        const websocket = this.realtime.getHealthSnapshot();
        if (!websocket.attached) {
            checks.websocket = 'error';
        }
        details.websocket = websocket;
        const [pending, blocked, retryPending, inProgress] = await Promise.all([
            this.prisma.warehouseTask.count({ where: { status: 'pending' } }),
            this.prisma.warehouseTask.count({ where: { status: 'blocked' } }),
            this.prisma.warehouseTask.count({ where: { status: 'retry_pending' } }),
            this.prisma.warehouseTask.count({ where: { status: 'in_progress' } }),
        ]);
        const retryPendingMax = this.config.get('READY_RETRY_PENDING_MAX') ?? 1000;
        if (retryPending > retryPendingMax) {
            checks.queues = 'error';
        }
        else if (blocked > 0) {
            checks.queues = 'warn';
        }
        details.queues = {
            pending,
            inProgress,
            blocked,
            retryPending,
            retryPendingMax,
        };
        const mem = process.memoryUsage();
        const rssMb = Math.round(mem.rss / 1024 / 1024);
        if (rssMb > 1024) {
            checks.process = 'warn';
        }
        details.process = {
            uptimeSec: Math.round(process.uptime()),
            rssMb,
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            pid: process.pid,
        };
        if (checks.db !== 'ok' || checks.websocket === 'error' || checks.queues === 'error') {
            throw new common_1.HttpException({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Readiness checks failed.',
                    details: { checks, ...details },
                },
            }, common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        return {
            status: 'ok',
            checks,
            details,
            timestamp: new Date().toISOString(),
        };
    }
    diagnostics(req) {
        const mem = process.memoryUsage();
        return {
            service: 'backend',
            env: process.env.NODE_ENV ?? 'development',
            uptimeSec: Math.round(process.uptime()),
            pid: process.pid,
            nodeVersion: process.version,
            requestId: req.headers['x-request-id'] ?? null,
            memory: {
                rss: mem.rss,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                external: mem.external,
            },
            timestamp: new Date().toISOString(),
        };
    }
};
exports.ObservabilityController = ObservabilityController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "live", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "ready", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('diagnostics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "diagnostics", null);
exports.ObservabilityController = ObservabilityController = __decorate([
    (0, common_1.Controller)('ops'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        realtime_service_1.RealtimeService,
        config_1.ConfigService])
], ObservabilityController);
//# sourceMappingURL=observability.controller.js.map