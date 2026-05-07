import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(cookieParser());

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser requests (curl, server-to-server) with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Dev-friendly fallback: any localhost / 127.0.0.1 port.
      if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Company-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      // Implicit boolean conversion treats any non-empty string as true (including "false");
      // query strings should be parsed by explicit @Transform (pagination, QueryBoolOptional, etc.).
      transformOptions: { enableImplicitConversion: false, exposeDefaultValues: true },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  const port = parseInt(config.get<string>('PORT') ?? '3000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[wms] backend listening on http://localhost:${port}/api`);
}

bootstrap();
