"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../errors/domain-exceptions");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        const requestId = req?.headers?.['x-request-id'] ?? req?.headers?.['x-correlation-id'];
        const env = process.env.NODE_ENV ?? 'development';
        const isProd = env === 'production';
        const { status, body } = this.toResponse(exception, isProd, requestId);
        if (status >= 500) {
            const err = exception instanceof Error ? exception : new Error(String(exception));
            const prefix = `[${req?.method ?? 'HTTP'} ${req?.url ?? 'unknown'}]`;
            if (isProd) {
                this.logger.error(`${prefix} ${err.name}: ${this.redact(err.message)}`);
            }
            else {
                this.logger.error(`${prefix} ${err.stack ?? err.message}`);
            }
        }
        else {
            this.logger.warn(`[${req?.method ?? 'HTTP'} ${req?.url ?? 'unknown'}] ${status} ${body.error.code}: ${this.redact(body.error.message)}`);
        }
        res.status(status).json(body);
    }
    toResponse(exception, isProd, requestId) {
        if (exception instanceof domain_exceptions_1.DomainException) {
            const code = exception.code;
            return {
                status: exception.getStatus(),
                body: {
                    success: false,
                    error: {
                        code,
                        message: this.sanitizeMessage(this.extractMessage(exception), isProd, exception.getStatus()),
                        ...(isProd ? {} : { details: this.sanitizeDetails(exception.details) }),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const response = exception.getResponse();
            let message = exception.message;
            let details;
            if (typeof response === 'string') {
                message = response;
            }
            else if (response && typeof response === 'object') {
                const r = response;
                message = r.message ?? message;
                details = r.message ?? r.error ?? response;
            }
            return {
                status,
                body: {
                    success: false,
                    error: {
                        code: this.codeFromStatus(status),
                        message: this.sanitizeMessage(Array.isArray(message) ? message.join('; ') : message, isProd, status),
                        ...(isProd ? {} : { details: this.sanitizeDetails(details) }),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return this.fromPrismaKnown(exception, isProd, requestId);
        }
        if (exception instanceof client_1.Prisma.PrismaClientValidationError) {
            return {
                status: common_1.HttpStatus.BAD_REQUEST,
                body: {
                    success: false,
                    error: {
                        code: 'PRISMA_VALIDATION',
                        message: this.sanitizeMessage(exception.message, isProd, common_1.HttpStatus.BAD_REQUEST),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        if (this.isPgError(exception)) {
            return this.fromPgError(exception, isProd, requestId);
        }
        return {
            status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            body: {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: this.sanitizeMessage(exception instanceof Error ? exception.message : 'Unknown error', isProd, common_1.HttpStatus.INTERNAL_SERVER_ERROR),
                    ...(requestId ? { requestId } : {}),
                },
            },
        };
    }
    fromPrismaKnown(err, isProd, requestId) {
        switch (err.code) {
            case 'P2002': {
                const target = err.meta?.target ?? 'unique constraint';
                return {
                    status: common_1.HttpStatus.CONFLICT,
                    body: {
                        success: false,
                        error: {
                            code: 'UNIQUE_VIOLATION',
                            message: this.sanitizeMessage(`Duplicate value for ${Array.isArray(target) ? target.join(', ') : target}.`, isProd, common_1.HttpStatus.CONFLICT),
                            ...(requestId ? { requestId } : {}),
                        },
                    },
                };
            }
            case 'P2025':
                return {
                    status: common_1.HttpStatus.NOT_FOUND,
                    body: {
                        success: false,
                        error: {
                            code: 'NOT_FOUND',
                            message: this.sanitizeMessage(err.message, isProd, common_1.HttpStatus.NOT_FOUND),
                            ...(requestId ? { requestId } : {}),
                        },
                    },
                };
            case 'P2003':
                return {
                    status: common_1.HttpStatus.BAD_REQUEST,
                    body: {
                        success: false,
                        error: {
                            code: 'FOREIGN_KEY_VIOLATION',
                            message: this.sanitizeMessage(err.message, isProd, common_1.HttpStatus.BAD_REQUEST),
                            ...(requestId ? { requestId } : {}),
                        },
                    },
                };
            default:
                return {
                    status: common_1.HttpStatus.BAD_REQUEST,
                    body: {
                        success: false,
                        error: {
                            code: 'PRISMA_ERROR_' + err.code,
                            message: this.sanitizeMessage(err.message, isProd, common_1.HttpStatus.BAD_REQUEST),
                            ...(requestId ? { requestId } : {}),
                        },
                    },
                };
        }
    }
    fromPgError(err, isProd, requestId) {
        const message = err.message ?? '';
        if (message.includes('exceeds 110%') || message.includes('expected_quantity')) {
            const dom = new domain_exceptions_1.OverReceiveException(message);
            return {
                status: dom.getStatus(),
                body: {
                    success: false,
                    error: {
                        code: 'QUANTITY_EXCEEDS_LIMIT',
                        message: this.sanitizeMessage(message, isProd, dom.getStatus()),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        if (message.includes('inventory_ledger duplicate')) {
            return {
                status: common_1.HttpStatus.CONFLICT,
                body: {
                    success: false,
                    error: {
                        code: 'IDEMPOTENT_REPLAY',
                        message: this.sanitizeMessage(message, isProd, common_1.HttpStatus.CONFLICT),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        if (message.includes('chk_qty_non_negative') ||
            message.includes('chk_reserved_lte_on_hand') ||
            message.includes('chk_reserved_non_negative')) {
            return {
                status: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
                body: {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: this.sanitizeMessage(message, isProd, common_1.HttpStatus.UNPROCESSABLE_ENTITY),
                        ...(requestId ? { requestId } : {}),
                    },
                },
            };
        }
        return {
            status: common_1.HttpStatus.BAD_REQUEST,
            body: {
                success: false,
                error: {
                    code: 'DB_CONSTRAINT_VIOLATION',
                    message: this.sanitizeMessage(message || String(err), isProd, common_1.HttpStatus.BAD_REQUEST),
                    ...(requestId ? { requestId } : {}),
                },
            },
        };
    }
    sanitizeMessage(message, isProd, status) {
        const clean = this.redact(message);
        if (!isProd)
            return clean;
        if (status >= 500)
            return 'Internal server error.';
        return clean;
    }
    sanitizeDetails(details) {
        if (details === null || details === undefined)
            return undefined;
        const text = typeof details === 'string' ? details : JSON.stringify(details);
        return this.redact(text).slice(0, 1000);
    }
    redact(input) {
        return input
            .replace(/(password|token|secret|authorization)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
            .replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'bearer [REDACTED]');
    }
    isPgError(value) {
        return (typeof value === 'object' &&
            value !== null &&
            typeof value.code === 'string' &&
            /^\d{5}$/.test(value.code) &&
            typeof value.message === 'string');
    }
    extractMessage(err) {
        const r = err.getResponse();
        if (typeof r === 'string')
            return r;
        if (r && typeof r === 'object') {
            const msg = r.message;
            if (typeof msg === 'string')
                return msg;
            if (Array.isArray(msg))
                return msg.join('; ');
        }
        return err.message;
    }
    codeFromStatus(status) {
        switch (status) {
            case 400:
                return 'BAD_REQUEST';
            case 401:
                return 'UNAUTHORIZED';
            case 403:
                return 'FORBIDDEN';
            case 404:
                return 'NOT_FOUND';
            case 409:
                return 'CONFLICT';
            case 422:
                return 'UNPROCESSABLE_ENTITY';
            default:
                return 'ERROR';
        }
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map