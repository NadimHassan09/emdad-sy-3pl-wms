"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertProductOrderableForOrders = assertProductOrderableForOrders;
const common_1 = require("@nestjs/common");
function assertProductOrderableForOrders(status) {
    if (status === 'suspended') {
        throw new common_1.BadRequestException('This product is suspended and cannot be used on inbound or outbound orders.');
    }
    if (status === 'archived') {
        throw new common_1.BadRequestException('This product is archived and cannot be used on inbound or outbound orders.');
    }
}
//# sourceMappingURL=assert-product-orderable.js.map