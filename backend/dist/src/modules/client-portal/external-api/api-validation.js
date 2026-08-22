"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwApiValidation = throwApiValidation;
const common_1 = require("@nestjs/common");
function throwApiValidation(message, fields) {
    throw new common_1.BadRequestException({
        code: 'VALIDATION_ERROR',
        message,
        fields: fields ?? {},
    });
}
//# sourceMappingURL=api-validation.js.map