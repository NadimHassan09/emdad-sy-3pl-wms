"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECRET_ONCE_WARNING = exports.API_KEY_PREFIX = void 0;
exports.hashApiSecret = hashApiSecret;
exports.verifyApiSecret = verifyApiSecret;
exports.generateApiKey = generateApiKey;
exports.generateApiSecret = generateApiSecret;
exports.apiKeyPrefix = apiKeyPrefix;
exports.maskApiKey = maskApiKey;
exports.parseApiCredentials = parseApiCredentials;
const node_crypto_1 = require("node:crypto");
exports.API_KEY_PREFIX = 'emd_live_';
exports.SECRET_ONCE_WARNING = 'Save this secret now. It will not be shown again.';
function hashApiSecret(secret) {
    return (0, node_crypto_1.createHash)('sha256').update(secret, 'utf8').digest('hex');
}
function verifyApiSecret(plain, storedHash) {
    if (!plain || !storedHash)
        return false;
    const candidate = hashApiSecret(plain);
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
function generateApiKey() {
    return `${exports.API_KEY_PREFIX}${(0, node_crypto_1.randomBytes)(16).toString('hex')}`;
}
function generateApiSecret() {
    return (0, node_crypto_1.randomBytes)(32).toString('base64url');
}
function apiKeyPrefix(apiKey) {
    if (apiKey.length <= 12)
        return `${apiKey.slice(0, 4)}…`;
    return `${apiKey.slice(0, 12)}…`;
}
function maskApiKey(apiKey) {
    if (apiKey.length <= 10)
        return '••••••••';
    return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}
function parseApiCredentials(input) {
    const keyHeader = firstHeader(input.apiKeyHeader)?.trim();
    const secretHeader = firstHeader(input.apiSecretHeader)?.trim();
    if (keyHeader && secretHeader) {
        return { apiKey: keyHeader, apiSecret: secretHeader };
    }
    const auth = firstHeader(input.authorization)?.trim();
    if (!auth)
        return null;
    const bearer = auth.match(/^Bearer\s+(.+)$/i);
    if (!bearer)
        return null;
    const token = bearer[1].trim();
    const split = token.split(':');
    if (split.length >= 2 && split[0].startsWith(exports.API_KEY_PREFIX)) {
        return { apiKey: split[0], apiSecret: split.slice(1).join(':') };
    }
    return null;
}
function firstHeader(value) {
    if (Array.isArray(value))
        return value[0];
    return value;
}
//# sourceMappingURL=api-credential.util.js.map