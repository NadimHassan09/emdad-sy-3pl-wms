"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireApiScope = exports.API_SCOPE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.API_SCOPE_KEY = 'apiCredentialScope';
const RequireApiScope = (scope) => (0, common_1.SetMetadata)(exports.API_SCOPE_KEY, scope);
exports.RequireApiScope = RequireApiScope;
//# sourceMappingURL=require-api-scope.decorator.js.map