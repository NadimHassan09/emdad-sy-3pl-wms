"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactAuditState = redactAuditState;
const SENSITIVE_KEY = /^(password|passwordhash|passwd|token|accesstoken|refreshtoken|secret|authorization|jwt|apikey|api_key|cookie|setcookie)$/i;
const BEARER_RE = /bearer\s+[a-z0-9\-._~+/]+=*/gi;
const KV_SECRET_RE = /(password|token|secret|authorization)\s*[:=]\s*([^\s,;]+)/gi;
const MAX_DEPTH = 10;
const MAX_STRING = 4000;
const MAX_ARRAY = 200;
function redactAuditState(value, depth = 0) {
    if (depth > MAX_DEPTH)
        return '[TRUNCATED_DEPTH]';
    if (value === null || value === undefined)
        return value;
    if (Array.isArray(value)) {
        const slice = value.slice(0, MAX_ARRAY);
        return slice.map((item) => redactAuditState(item, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, child] of Object.entries(value)) {
            const normalized = key.replace(/[_-]/g, '').toLowerCase();
            if (SENSITIVE_KEY.test(normalized)) {
                out[key] = '[REDACTED]';
            }
            else {
                out[key] = redactAuditState(child, depth + 1);
            }
        }
        return out;
    }
    if (typeof value === 'string') {
        let s = value;
        if (s.length > MAX_STRING) {
            s = `${s.slice(0, MAX_STRING)}…[TRUNCATED]`;
        }
        return s.replace(BEARER_RE, 'bearer [REDACTED]').replace(KV_SECRET_RE, '$1=[REDACTED]');
    }
    return value;
}
//# sourceMappingURL=audit-log-redaction.util.js.map