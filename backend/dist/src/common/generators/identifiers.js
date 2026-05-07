"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSkuCandidate = generateSkuCandidate;
exports.generateBarcodeCandidate = generateBarcodeCandidate;
exports.generateLotCandidate = generateLotCandidate;
exports.slugifyForBarcode = slugifyForBarcode;
const node_crypto_1 = require("node:crypto");
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomToken(length) {
    const bytes = (0, node_crypto_1.randomBytes)(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
}
function generateSkuCandidate() {
    const random = randomToken(6);
    const ts = Date.now().toString(36).toUpperCase();
    return `SKU-${random}-${ts}`;
}
function generateBarcodeCandidate() {
    const random = randomToken(8);
    const ts = Date.now().toString(36).toUpperCase();
    return `BCN-${random}-${ts}`;
}
function generateLotCandidate() {
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = now.getUTCDate().toString().padStart(2, '0');
    return `LOT-${yyyy}${mm}${dd}-${randomToken(4)}`;
}
function slugifyForBarcode(text) {
    return text
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
//# sourceMappingURL=identifiers.js.map