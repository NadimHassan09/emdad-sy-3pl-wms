"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CYCLE_COUNT_LOCATION_TYPES = exports.CYCLE_COUNT_ACTIVE_STATUSES = exports.CYCLE_COUNT_INTERVAL_DAYS = void 0;
exports.isValidCycleCountInterval = isValidCycleCountInterval;
exports.addDays = addDays;
exports.CYCLE_COUNT_INTERVAL_DAYS = [7, 30, 90];
exports.CYCLE_COUNT_ACTIVE_STATUSES = [
    'scheduled',
    'in_progress',
    'pending_review',
];
exports.CYCLE_COUNT_LOCATION_TYPES = [
    'internal',
    'fridge',
    'quarantine',
    'scrap',
];
function isValidCycleCountInterval(days) {
    return exports.CYCLE_COUNT_INTERVAL_DAYS.includes(days);
}
function addDays(from, days) {
    return new Date(from.getTime() + days * 86_400_000);
}
//# sourceMappingURL=cycle-count.constants.js.map