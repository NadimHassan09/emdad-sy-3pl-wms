"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDriveRetryDelayMs = computeDriveRetryDelayMs;
function computeDriveRetryDelayMs(attempt, baseSec, maxSec) {
    const baseMs = Math.max(1, baseSec) * 1000;
    const maxMs = Math.max(baseMs, maxSec * 1000);
    const exponent = Math.max(0, attempt - 1);
    const delay = baseMs * 2 ** exponent;
    return Math.min(maxMs, delay);
}
//# sourceMappingURL=backup-drive-retry.util.js.map