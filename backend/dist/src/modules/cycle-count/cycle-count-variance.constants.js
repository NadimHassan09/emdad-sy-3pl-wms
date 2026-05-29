"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_VARIANCE_STATUSES = exports.VARIANCE_REASON_CODES = void 0;
exports.formatVarianceReasonLabel = formatVarianceReasonLabel;
exports.VARIANCE_REASON_CODES = [
    'damaged',
    'lost',
    'misplaced',
    'theft_suspected',
    'counting_mistake',
    'operational_correction',
    'unknown',
];
exports.TERMINAL_VARIANCE_STATUSES = ['posted', 'rejected'];
function formatVarianceReasonLabel(code) {
    return code.replace(/_/g, ' ');
}
//# sourceMappingURL=cycle-count-variance.constants.js.map