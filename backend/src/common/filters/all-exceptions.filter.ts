import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

import { DomainException, OverReceiveException } from '../errors/domain-exceptions';

interface ErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ method?: string; url?: string; headers?: Record<string, string | undefined> }>();
    const requestId = req?.headers?.['x-request-id'] ?? req?.headers?.['x-correlation-id'];
    const env = process.env.NODE_ENV ?? 'development';
    const isProd = env === 'production';

    const { status, body } = this.toResponse(exception, isProd, requestId);

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      const prefix = `[${req?.method ?? 'HTTP'} ${req?.url ?? 'unknown'}]`;
      if (isProd) {
        this.logger.error(`${prefix} ${err.name}: ${this.redact(err.message)}`);
      } else {
        this.logger.error(`${prefix} ${err.stack ?? err.message}`);
      }
    } else {
      this.logger.warn(
        `[${req?.method ?? 'HTTP'} ${req?.url ?? 'unknown'}] ${status} ${body.error.code}: ${this.redact(body.error.message)}`,
      );
    }

    res.status(status).json(body);
  }

  private toResponse(
    exception: unknown,
    isProd: boolean,
    requestId?: string,
  ): { status: number; body: ErrorPayload } {
    if (exception instanceof DomainException) {
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

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: unknown;
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        message = (r.message as string) ?? message;
        details = r.message ?? r.error ?? response;
      }
      return {
        status,
        body: {
          success: false,
          error: {
            code: this.codeFromStatus(status),
            message: this.sanitizeMessage(
              Array.isArray(message) ? message.join('; ') : message,
              isProd,
              status,
            ),
            ...(isProd ? {} : { details: this.sanitizeDetails(details) }),
            ...(requestId ? { requestId } : {}),
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnown(exception, isProd, requestId);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: 'PRISMA_VALIDATION',
            message: this.sanitizeMessage(exception.message, isProd, HttpStatus.BAD_REQUEST),
            ...(requestId ? { requestId } : {}),
          },
        },
      };
    }

    if (this.isPgError(exception)) {
      return this.fromPgError(exception, isProd, requestId);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: this.sanitizeMessage(
            exception instanceof Error ? exception.message : 'Unknown error',
            isProd,
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  private fromPrismaKnown(
    err: Prisma.PrismaClientKnownRequestError,
    isProd: boolean,
    requestId?: string,
  ): { status: number; body: ErrorPayload } {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string) ?? 'unique constraint';
        return {
          status: HttpStatus.CONFLICT,
          body: {
            success: false,
            error: {
              code: 'UNIQUE_VIOLATION',
              message: this.sanitizeMessage(
                `Duplicate value for ${Array.isArray(target) ? target.join(', ') : target}.`,
                isProd,
                HttpStatus.CONFLICT,
              ),
              ...(requestId ? { requestId } : {}),
            },
          },
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: this.sanitizeMessage(err.message, isProd, HttpStatus.NOT_FOUND),
              ...(requestId ? { requestId } : {}),
            },
          },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            success: false,
            error: {
              code: 'FOREIGN_KEY_VIOLATION',
              message: this.sanitizeMessage(err.message, isProd, HttpStatus.BAD_REQUEST),
              ...(requestId ? { requestId } : {}),
            },
          },
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            success: false,
            error: {
              code: 'PRISMA_ERROR_' + err.code,
              message: this.sanitizeMessage(err.message, isProd, HttpStatus.BAD_REQUEST),
              ...(requestId ? { requestId } : {}),
            },
          },
        };
    }
  }

  /**
   * Bubble specific Postgres errors raised by the schema's triggers/checks
   * (improved_schema.sql) into typed domain errors.
   */
  private fromPgError(
    err: PgErrorLike,
    isProd: boolean,
    requestId?: string,
  ): { status: number; body: ErrorPayload } {
    const message = err.message ?? '';

    if (message.includes('exceeds 110%') || message.includes('expected_quantity')) {
      const dom = new OverReceiveException(message);
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
        status: HttpStatus.CONFLICT,
        body: {
          success: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: this.sanitizeMessage(message, isProd, HttpStatus.CONFLICT),
            ...(requestId ? { requestId } : {}),
          },
        },
      };
    }

    if (
      message.includes('chk_qty_non_negative') ||
      message.includes('chk_reserved_lte_on_hand') ||
      message.includes('chk_reserved_non_negative')
    ) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: this.sanitizeMessage(message, isProd, HttpStatus.UNPROCESSABLE_ENTITY),
            ...(requestId ? { requestId } : {}),
          },
        },
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        success: false,
        error: {
          code: 'DB_CONSTRAINT_VIOLATION',
          message: this.sanitizeMessage(message || String(err), isProd, HttpStatus.BAD_REQUEST),
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  private sanitizeMessage(message: string, isProd: boolean, status: number): string {
    const clean = this.redact(message);
    if (!isProd) return clean;
    if (status >= 500) return 'Internal server error.';
    return clean;
  }

  private sanitizeDetails(details: unknown): unknown {
    if (details === null || details === undefined) return undefined;
    const text = typeof details === 'string' ? details : JSON.stringify(details);
    return this.redact(text).slice(0, 1000);
  }

  private redact(input: string): string {
    return input
      .replace(/(password|token|secret|authorization)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
      .replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'bearer [REDACTED]');
  }

  private isPgError(value: unknown): value is PgErrorLike {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as PgErrorLike).code === 'string' &&
      /^\d{5}$/.test((value as PgErrorLike).code as string) &&
      typeof (value as PgErrorLike).message === 'string'
    );
  }

  private extractMessage(err: HttpException): string {
    const r = err.getResponse();
    if (typeof r === 'string') return r;
    if (r && typeof r === 'object') {
      const msg = (r as Record<string, unknown>).message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg)) return msg.join('; ');
    }
    return err.message;
  }

  private codeFromStatus(status: number): string {
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
}

interface PgErrorLike {
  code?: string;
  message?: string;
  detail?: string;
}
