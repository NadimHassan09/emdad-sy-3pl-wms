import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain exceptions carry a stable `code` so the frontend can branch on
 * specific failure modes (e.g. INSUFFICIENT_STOCK) without parsing messages.
 *
 * Optional `details` is included verbatim in the JSON response body so the UI
 * can render structured information (e.g. per-product shortage list).
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export interface StockShortage {
  productId: string;
  requested: string;
  available: string;
}

export class InsufficientStockException extends DomainException {
  constructor(
    message = 'Insufficient stock to fulfil the requested quantity.',
    details?: StockShortage[],
  ) {
    super('INSUFFICIENT_STOCK', message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class InvalidStateException extends DomainException {
  constructor(message: string) {
    super('INVALID_STATE', message, HttpStatus.CONFLICT);
  }
}

export class OverReceiveException extends DomainException {
  constructor(message = 'Received quantity exceeds the 110% over-receive tolerance.') {
    super('QUANTITY_EXCEEDS_LIMIT', message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class LotRequiredException extends DomainException {
  constructor(message = 'lotNumber is required for lot-tracked products.') {
    super('LOT_REQUIRED', message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidLocationTypeException extends DomainException {
  constructor(
    message = 'Destination location must be of type "internal" for receiving.',
  ) {
    super('INVALID_LOCATION_TYPE', message, HttpStatus.BAD_REQUEST);
  }
}

export class LotLockedException extends DomainException {
  constructor(
    message = 'Expected lot is locked. Pass overrideLot=true to change it.',
  ) {
    super('LOT_LOCKED', message, HttpStatus.CONFLICT);
  }
}
