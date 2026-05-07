"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: false });
    const config = app.get(config_1.ConfigService);
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.use((0, cookie_parser_1.default)());
    const corsOrigins = (config.get('CORS_ORIGINS') ?? 'http://localhost:5173')
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
            if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS origin not allowed: ${origin}`), false);
        },
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Company-Id'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: false, exposeDefaultValues: true },
    }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.setGlobalPrefix('api');
    const port = parseInt(config.get('PORT') ?? '3000', 10);
    await app.listen(port);
    console.log(`[wms] backend listening on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map