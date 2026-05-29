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
exports.ObservabilityService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const redis_service_1 = require("../../common/redis/redis.service");
const realtime_service_1 = require("../realtime/realtime.service");
const ops_policy_config_1 = require("./ops-policy.config");
let ObservabilityService = class ObservabilityService {
    prisma;
    redis;
    realtime;
    config;
    policy;
    constructor(prisma, redis, realtime, config, policy) {
        this.prisma = prisma;
        this.redis = redis;
        this.realtime = realtime;
        this.config = config;
        this.policy = policy;
    }
    assertLivenessEnabled() {
        if (!this.policy.livenessEnabled) {
            throw new common_1.NotFoundException();
        }
    }
    assertReadinessEnabled() {
        if (!this.policy.readinessEnabled) {
            throw new common_1.NotFoundException();
        }
    }
    assertDiagnosticsEnabled() {
        if (!this.policy.diagnosticsEnabled) {
            throw new common_1.NotFoundException();
        }
    }
    live() {
        return {
            status: 'ok',
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
        const mem = process.memoryUsage();
        const rssMb = Math.round(mem.rss / 1024 / 1024);
        if (rssMb > 1024) {
            checks.process = 'warn';
        }
        if (this.policy.readinessVerbose) {
            details.websocket = websocket;
            details.queues = {
                pending,
                inProgress,
                blocked,
                retryPending,
                retryPendingMax,
            };
            details.process = {
                uptimeSec: Math.round(process.uptime()),
                rssMb,
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                pid: process.pid,
            };
        }
        if (checks.db !== 'ok' || checks.websocket === 'error' || checks.queues === 'error') {
            const failureBody = {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Readiness checks failed.',
                    details: this.policy.readinessVerbose
                        ? { checks, ...details }
                        : { checks },
                },
            };
            throw new common_1.HttpException(failureBody, common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        const result = {
            status: 'ok',
            checks,
            timestamp: new Date().toISOString(),
        };
        if (this.policy.readinessVerbose && Object.keys(details).length > 0) {
            result.details = details;
        }
        return result;
    }
    diagnostics(req) {
        const mem = process.memoryUsage();
        const timestamp = new Date().toISOString();
        if (this.policy.isProduction) {
            return {
                service: 'backend',
                uptimeSec: Math.round(process.uptime()),
                memory: {
                    rssMb: Math.round(mem.rss / 1024 / 1024),
                    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                },
                timestamp,
            };
        }
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
            policy: this.policy.snapshot(),
            timestamp,
        };
    }
};
exports.ObservabilityService = ObservabilityService;
exports.ObservabilityService = ObservabilityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        realtime_service_1.RealtimeService,
        config_1.ConfigService,
        ops_policy_config_1.OpsPolicyConfig])
], ObservabilityService);
//# sourceMappingURL=observability.service.js.map