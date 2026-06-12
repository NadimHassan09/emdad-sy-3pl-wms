import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ApplicationLifecycleService } from './common/lifecycle/application-lifecycle.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RedisIoAdapter } from './common/redis/redis-io.adapter';

type JsonLike = Record<string, unknown> | unknown[];

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__proto__' || k === 'prototype' || k === 'constructor') {
      continue;
    }
    out[k] = sanitizeValue(v);
  }
  return out;
}

function sanitizeRequestPayload(req: Request, _res: Response, next: NextFunction): void {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body) as JsonLike;
  }
  next();
}

function validateStartupSafety(config: ConfigService, isProd: boolean): void {
  if (!isProd) return;

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  const hasLocalhost = corsOrigins.some(
    (o) => o.includes('localhost') || o.includes('127.0.0.1'),
  );
  if (hasLocalhost) {
    throw new Error('Production startup blocked: CORS_ORIGINS must not include localhost or 127.0.0.1.');
  }
}

function installRequestTracingAndStructuredLogs(app: INestApplication): void {
  const httpLogger = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    const incomingRequestId = req.header('x-request-id') || req.header('x-correlation-id');
    const requestId = incomingRequestId?.trim() || randomUUID();
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

function installPm2ClusterSignals(
  app: INestApplication,
  lifecycle: ApplicationLifecycleService,
  logger: Logger,
): void {
  if (typeof process.send === 'function') {
    process.on('message', (msg: unknown) => {
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
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const lifecycle = app.get(ApplicationLifecycleService);
  const isProd = config.get<string>('NODE_ENV') === 'production';
  validateStartupSafety(config, isProd);

  app.enableShutdownHooks();

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: isProd ? undefined : false,
      hsts: isProd,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(express.json({ limit: config.get<string>('HTTP_JSON_BODY_LIMIT') ?? '100kb' }));
  app.use(
    express.urlencoded({
      limit: config.get<string>('HTTP_FORM_BODY_LIMIT') ?? '100kb',
      extended: false,
    }),
  );
  app.use(cookieParser());
  app.use(sanitizeRequestPayload);
  installRequestTracingAndStructuredLogs(app);
  installPm2ClusterSignals(app, lifecycle, logger);

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
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

  app.useGlobalPipes(
    new ValidationPipe({
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
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  const port = parseInt(config.get<string>('PORT') ?? '3000', 10);
  await app.listen(port);

  lifecycle.markReady();

  if (typeof process.send === 'function') {
    process.send('ready');
  }

  if (isProd) {
    logger.log(
      `[wms] backend listening on port ${port} (instance=${lifecycle.instanceId()}, pid=${process.pid})`,
    );
  } else {
    logger.log(
      `[wms] backend listening on http://localhost:${port}/api (instance=${lifecycle.instanceId()})`,
    );
  }
}

bootstrap();