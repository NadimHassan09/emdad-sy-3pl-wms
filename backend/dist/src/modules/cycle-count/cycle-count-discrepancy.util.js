"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCycleCountDiscrepancy = computeCycleCountDiscrepancy;
exports.hasCycleCountDiscrepancy = hasCycleCountDiscrepancy;
function computeCycleCountDiscrepancy(expected, actual) {
    return actual.minus(expected);
}
function hasCycleCountDiscrepancy(discrepancy) {
    return !discrepancy.isZero();
}
//# sourceMappingURL=cycle-count-discrepancy.util.js.map