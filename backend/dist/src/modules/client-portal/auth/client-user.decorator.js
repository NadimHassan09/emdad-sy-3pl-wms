"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUser = void 0;
const common_1 = require("@nestjs/common");
exports.ClientUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
});
//# sourceMappingURL=client-user.decorator.js.map