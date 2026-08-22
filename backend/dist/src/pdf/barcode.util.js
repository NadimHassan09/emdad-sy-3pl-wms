"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.barcodePngDataUri = barcodePngDataUri;
const bwip_js_1 = __importDefault(require("bwip-js"));
async function barcodePngDataUri(text) {
    const normalized = text.trim();
    if (!normalized)
        return '';
    try {
        const png = await new Promise((resolve, reject) => {
            bwip_js_1.default.toBuffer({
                bcid: 'code128',
                text: normalized,
                scale: 2,
                height: 10,
                includetext: true,
                textsize: 9,
                textxalign: 'center',
                paddingwidth: 4,
                paddingheight: 2,
            }, (err, buffer) => (err ? reject(err) : resolve(buffer)));
        });
        return `data:image/png;base64,${png.toString('base64')}`;
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=barcode.util.js.map