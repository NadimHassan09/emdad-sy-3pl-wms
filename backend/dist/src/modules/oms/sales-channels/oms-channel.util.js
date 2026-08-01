"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashWebhookSecret = hashWebhookSecret;
exports.verifyWebhookSecret = verifyWebhookSecret;
exports.generateWebhookSecret = generateWebhookSecret;
const node_crypto_1 = require("node:crypto");
function hashWebhookSecret(secret) {
    return (0, node_crypto_1.createHash)('sha256').update(secret, 'utf8').digest('hex');
}
function verifyWebhookSecret(plain, storedHash) {
    const candidate = hashWebhookSecret(plain);
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
function generateWebhookSecret() {
    return (0, node_crypto_1.createHash)('sha256')
        .update(`${Date.now()}-${Math.random()}`)
        .digest('hex');
}
//# sourceMappingURL=oms-channel.util.js.map