"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = getClientIp;
function getClientIp(req) {
    if (!req)
        return 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}
//# sourceMappingURL=request-ip.util.js.map