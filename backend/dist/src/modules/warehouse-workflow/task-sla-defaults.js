"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SLA_MINUTES_BY_TASK_TYPE = void 0;
exports.defaultSlaMinutesForTaskType = defaultSlaMinutesForTaskType;
const client_1 = require("@prisma/client");
exports.DEFAULT_SLA_MINUTES_BY_TASK_TYPE = {
    [client_1.WarehouseTaskType.receiving]: 1440,
    [client_1.WarehouseTaskType.qc]: 720,
    [client_1.WarehouseTaskType.putaway]: 2880,
    [client_1.WarehouseTaskType.putaway_quarantine]: 2880,
    [client_1.WarehouseTaskType.pick]: 480,
    [client_1.WarehouseTaskType.pack]: 240,
    [client_1.WarehouseTaskType.dispatch]: 360,
};
function defaultSlaMinutesForTaskType(taskType) {
    return exports.DEFAULT_SLA_MINUTES_BY_TASK_TYPE[taskType];
}
//# sourceMappingURL=task-sla-defaults.js.map