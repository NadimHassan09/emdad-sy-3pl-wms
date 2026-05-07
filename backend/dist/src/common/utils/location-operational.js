"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLocationUsableForInventoryMove = assertLocationUsableForInventoryMove;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function assertLocationUsableForInventoryMove(status) {
    if (status === client_1.LocationStatus.blocked) {
        throw new common_1.BadRequestException('This location is suspended and cannot be used for inventory moves or tasks.');
    }
    if (status === client_1.LocationStatus.archived) {
        throw new common_1.BadRequestException('This location is archived and cannot be used.');
    }
}
//# sourceMappingURL=location-operational.js.map