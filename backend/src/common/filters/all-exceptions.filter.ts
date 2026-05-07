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
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const { status, body } = this.toResponse(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(`${status} ${body.error.code}: ${body.error.message}`);
    }

    res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorPayload } {
    if (exception instanceof DomainException) {
      const code = exception.code;
      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: {
            code,
            message: this.extractMessage(exception),
            details: exception.details,
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
            message: Array.isArray(message) ? message.join('; ') : message,
            details,
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnown(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: { code: 'PRISMA_VALIDATION', message: exception.message },
        },
      };
    }

    if (this.isPgError(exception)) {
      return this.fromPgError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: exception instanceof Error ? exception.message : 'Unknown error',
        },
      },
    };
  }

  private fromPrismaKnown(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ErrorPayload;
  } {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string) ?? 'unique constraint';
        return {
          status: HttpStatus.CONFLICT,
          body: {
            success: false,
            error: {
              code: 'UNIQUE_VIOLATION',
              message: `Duplicate value for ${Array.isArray(target) ? target.join(', ') : target}.`,
            },
          },
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { success: false, error: { code: 'NOT_FOUND', message: err.message } },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            success: false,
            error: { code: 'FOREIGN_KEY_VIOLATION', message: err.message },
          },
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: { success: false, error: { code: 'PRISMA_ERROR_' + err.code, message: err.message } },
        };
    }
  }

  /**
   * Bubble specific Postgres errors raised by the schema's triggers/checks
   * (improved_schema.sql) into typed domain errors.
   */
  private fromPgError(err: PgErrorLike): { status: number; body: ErrorPayload } {
    const message = err.message ?? '';

    if (message.includes('exceeds 110%') || message.includes('expected_quantity')) {
      const dom = new OverReceiveException(message);
      return {
        status: dom.getStatus(),
        body: { success: false, error: { code: 'QUANTITY_EXCEEDS_LIMIT', message } },
      };
    }

    if (message.includes('inventory_ledger duplicate')) {
      return {
        status: HttpStatus.CONFLICT,
        body: { success: false, error: { code: 'IDEMPOTENT_REPLAY', message } },
      };
    }

    if (
      message.includes('chk_qty_non_negative') ||
      message.includes('chk_reserved_lte_on_hand') ||
      message.includes('chk_reserved_non_negative')
    ) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: { success: false, error: { code: 'INSUFFICIENT_STOCK', message } },
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        success: false,
        error: { code: 'DB_CONSTRAINT_VIOLATION', message: message || String(err) },
      },
    };
  }

  private isPgError(value: unknown): value is PgErrorLike {
    return (
      typeof value === 'object' &&
      value !== null &&
      ('code' in value || 'message' in value) &&
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
