"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETURN_ACTIVE_FOR_QUOTA = exports.RETURN_TERMINAL = exports.RETURN_COMPLETABLE = exports.RETURN_INVENTORY_APPLICABLE = exports.RETURN_INSPECTABLE = exports.RETURN_RECEIVABLE = exports.RETURN_CONFIRMABLE = exports.MAX_RETURN_LINES_PER_ORDER = void 0;
exports.isReturnConfirmable = isReturnConfirmable;
exports.isReturnReceivable = isReturnReceivable;
exports.isReturnInspectable = isReturnInspectable;
exports.isReturnInventoryApplicable = isReturnInventoryApplicable;
exports.isReturnCompletable = isReturnCompletable;
exports.isReturnTerminal = isReturnTerminal;
const client_1 = require("@prisma/client");
exports.MAX_RETURN_LINES_PER_ORDER = 50;
exports.RETURN_CONFIRMABLE = [client_1.ReturnOrderStatus.draft];
exports.RETURN_RECEIVABLE = [
    client_1.ReturnOrderStatus.confirmed,
    client_1.ReturnOrderStatus.receiving,
    client_1.ReturnOrderStatus.inspecting,
];
exports.RETURN_INSPECTABLE = [
    client_1.ReturnOrderStatus.receiving,
    client_1.ReturnOrderStatus.inspecting,
];
exports.RETURN_INVENTORY_APPLICABLE = [
    client_1.ReturnOrderStatus.receiving,
    client_1.ReturnOrderStatus.inspecting,
];
exports.RETURN_COMPLETABLE = [
    client_1.ReturnOrderStatus.receiving,
    client_1.ReturnOrderStatus.inspecting,
];
exports.RETURN_TERMINAL = [
    client_1.ReturnOrderStatus.completed,
    client_1.ReturnOrderStatus.cancelled,
];
exports.RETURN_ACTIVE_FOR_QUOTA = [
    client_1.ReturnOrderStatus.draft,
    client_1.ReturnOrderStatus.confirmed,
    client_1.ReturnOrderStatus.receiving,
    client_1.ReturnOrderStatus.inspecting,
    client_1.ReturnOrderStatus.completed,
];
function isReturnConfirmable(status) {
    return exports.RETURN_CONFIRMABLE.includes(status);
}
function isReturnReceivable(status) {
    return exports.RETURN_RECEIVABLE.includes(status);
}
function isReturnInspectable(status) {
    return exports.RETURN_INSPECTABLE.includes(status);
}
function isReturnInventoryApplicable(status) {
    return exports.RETURN_INVENTORY_APPLICABLE.includes(status);
}
function isReturnCompletable(status) {
    return exports.RETURN_COMPLETABLE.includes(status);
}
function isReturnTerminal(status) {
    return exports.RETURN_TERMINAL.includes(status);
}
//# sourceMappingURL=returns.constants.js.map