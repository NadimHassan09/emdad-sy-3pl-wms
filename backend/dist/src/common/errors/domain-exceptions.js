"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LotLockedException = exports.InvalidLocationTypeException = exports.LotRequiredException = exports.OverReceiveException = exports.InvalidStateException = exports.InsufficientStockException = exports.DomainException = void 0;
const common_1 = require("@nestjs/common");
class DomainException extends common_1.HttpException {
    code;
    details;
    constructor(code, message, status = common_1.HttpStatus.BAD_REQUEST, details) {
        super({ code, message, details }, status);
        this.code = code;
        this.details = details;
    }
}
exports.DomainException = DomainException;
class InsufficientStockException extends DomainException {
    constructor(message = 'Insufficient stock to fulfil the requested quantity.', details) {
        super('INSUFFICIENT_STOCK', message, common_1.HttpStatus.UNPROCESSABLE_ENTITY, details);
    }
}
exports.InsufficientStockException = InsufficientStockException;
class InvalidStateException extends DomainException {
    constructor(message) {
        super('INVALID_STATE', message, common_1.HttpStatus.CONFLICT);
    }
}
exports.InvalidStateException = InvalidStateException;
class OverReceiveException extends DomainException {
    constructor(message = 'Received quantity exceeds the 110% over-receive tolerance.') {
        super('QUANTITY_EXCEEDS_LIMIT', message, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
exports.OverReceiveException = OverReceiveException;
class LotRequiredException extends DomainException {
    constructor(message = 'lotNumber is required for lot-tracked products.') {
        super('LOT_REQUIRED', message, common_1.HttpStatus.BAD_REQUEST);
    }
}
exports.LotRequiredException = LotRequiredException;
class InvalidLocationTypeException extends DomainException {
    constructor(message = 'Destination location must be of type "internal" for receiving.') {
        super('INVALID_LOCATION_TYPE', message, common_1.HttpStatus.BAD_REQUEST);
    }
}
exports.InvalidLocationTypeException = InvalidLocationTypeException;
class LotLockedException extends DomainException {
    constructor(message = 'Expected lot is locked. Pass overrideLot=true to change it.') {
        super('LOT_LOCKED', message, common_1.HttpStatus.CONFLICT);
    }
}
exports.LotLockedException = LotLockedException;
//# sourceMappingURL=domain-exceptions.js.map