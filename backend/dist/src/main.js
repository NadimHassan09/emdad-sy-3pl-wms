"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const application_lifecycle_service_1 = require("./common/lifecycle/application-lifecycle.service");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
const redis_io_adapter_1 = require("./common/redis/redis-io.adapter");
function sanitizeValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const obj = value;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') {
            continue;
        }
        out[k] = sanitizeValue(v);
    }
    return out;
}
function sanitizeRequestPayload(req, _res, next) {
    if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    next();
}
function validateStartupSafety(config, isProd) {
    if (!isProd)
        return;
    const corsOrigins = (config.get('CORS_ORIGINS') ?? '')
        .split(',')
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean);
    const hasLocalhost = corsOrigins.some((o) => o.includes('localhost') || o.includes('127.0.0.1'));
    if (hasLocalhost) {
        throw new Error('Production startup blocked: CORS_ORIGINS must not include localhost or 127.0.0.1.');
    }
}
function installRequestTracingAndStructuredLogs(app) {
    const httpLogger = new common_1.Logger('HTTP');
    app.use((req, res, next) => {
        const started = process.hrtime.bigint();
        const incomingRequestId = req.header('x-request-id') || req.header('x-correlation-id');
        const requestId = incomingRequestId?.trim() || (0, node_crypto_1.randomUUID)();
        res.setHeader('x-request-id', requestId);
        res.locals.requestId = requestId;
        res.on('finish', () => {
            const elapsedMs = Number((process.hrtime.bigint() - started) / BigInt(1_000_000));
            const principal = req.user;
            const logRecord = {
                ts: new Date().toISOString(),
                level: 'info',
                msg: 'http_request',
                requestId,
                method: req.method,
                path: req.originalUrl ?? req.url,
                statusCode: res.statusCode,
                durationMs: elapsedMs,
                ip: req.ip,
                userAgent: req.get('user-agent') ?? null,
                actorId: principal?.id ?? null,
                actorRole: principal?.role ?? null,
            };
            httpLogger.log(JSON.stringify(logRecord));
        });
        next();
    });
}
function installPm2ClusterSignals(app, lifecycle, logger) {
    if (typeof process.send === 'function') {
        process.on('message', (msg) => {
            if (msg === 'shutdown') {
                lifecycle.markShuttingDown('pm2_shutdown_message');
                void app.close().then(() => {
                    logger.log('PM2 shutdown message handled — application closed.');
                });
            }
        });
    }
}
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: false });
    const config = app.get(config_1.ConfigService);
    const lifecycle = app.get(application_lifecycle_service_1.ApplicationLifecycleService);
    const isProd = config.get('NODE_ENV') === 'production';
    validateStartupSafety(config, isProd);
    app.enableShutdownHooks();
    const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    app.use((0, helmet_1.default)({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: isProd ? undefined : false,
        hsts: isProd,
        referrerPolicy: { policy: 'no-referrer' },
    }));
    app.use(express_1.default.json({ limit: config.get('HTTP_JSON_BODY_LIMIT') ?? '100kb' }));
    app.use(express_1.default.urlencoded({
        limit: config.get('HTTP_FORM_BODY_LIMIT') ?? '100kb',
        extended: false,
    }));
    app.use((0, cookie_parser_1.default)());
    app.use(sanitizeRequestPayload);
    installRequestTracingAndStructuredLogs(app);
    installPm2ClusterSignals(app, lifecycle, logger);
    const corsOrigins = [
        config.get('CORS_ORIGINS') ?? 'http://localhost:5173',
        config.get('LANDING_FORM_CORS_ORIGINS') ?? '',
    ]
        .join(',')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }
            if (corsOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS origin not allowed: ${origin}`), false);
        },
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Company-Id'],
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        optionsSuccessStatus: 204,
        maxAge: 86400,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        stopAtFirstError: true,
        validationError: {
            target: false,
            value: false,
        },
        transformOptions: { enableImplicitConversion: false, exposeDefaultValues: true },
    }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.setGlobalPrefix('api');
    const port = parseInt(config.get('PORT') ?? '3000', 10);
    await app.listen(port);
    lifecycle.markReady();
    if (typeof process.send === 'function') {
        process.send('ready');
    }
    if (isProd) {
        logger.log(`[wms] backend listening on port ${port} (instance=${lifecycle.instanceId()}, pid=${process.pid})`);
    }
    else {
        logger.log(`[wms] backend listening on http://localhost:${port}/api (instance=${lifecycle.instanceId()})`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map