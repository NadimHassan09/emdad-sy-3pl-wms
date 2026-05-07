"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) {
        throw new common_1.UnauthorizedException('No authenticated user. Set X-User-Id header or MOCK_USER_ID env var.');
    }
    return req.user;
});
//# sourceMappingURL=current-user.decorator.js.map