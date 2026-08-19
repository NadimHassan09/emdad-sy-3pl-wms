"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelExpressAdapter = void 0;
const common_1 = require("@nestjs/common");
const shipping_constants_1 = require("../../shipping.constants");
const babel_express_http_client_1 = require("./babel-express.http-client");
const babel_shipment_mapper_1 = require("./babel-shipment.mapper");
let BabelExpressAdapter = class BabelExpressAdapter {
    http;
    code = shipping_constants_1.BABEL_EXPRESS_CODE;
    capabilities = {
        supportsQuote: true,
        supportsLabelPrinting: true,
        labelDelivery: 'api',
    };
    constructor(http) {
        this.http = http;
    }
    async testConnection(credentials) {
        try {
            await this.http.post('getCities', credentials, {});
            return { ok: true, message: 'Babel Express connection OK.' };
        }
        catch (err) {
            let message = err instanceof babel_express_http_client_1.BabelApiError
                ? err.message
                : err instanceof Error
                    ? err.message
                    : 'Connection test failed.';
            if (/^unauthorized$/i.test(message.trim())) {
                message =
                    'Babel Express rejected these credentials. Use the reseller username and password from Babel Express (not your WMS login).';
            }
            return { ok: false, message };
        }
    }
    async createShipment(credentials, input) {
        const payload = (0, babel_shipment_mapper_1.mapCreateShipmentPayload)(input);
        const raw = await this.http.post('createShipment', credentials, payload);
        const awb = typeof raw?.awb === 'string' ? raw.awb.trim() : '';
        if (!awb) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express createShipment succeeded without awb.', undefined, raw);
        }
        return { awb, raw };
    }
    async getQuote(credentials, input) {
        const payload = (0, babel_shipment_mapper_1.mapCalculatePricePayload)(input);
        const raw = await this.http.post('calculatePrice', credentials, payload);
        const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
        if (!Number.isFinite(price)) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
        }
        return {
            price,
            currency: typeof raw?.currency === 'string' ? raw.currency : 'USD',
            details: raw?.details,
        };
    }
    async getLabel(credentials, awb) {
        const trimmed = awb.trim();
        if (!trimmed)
            return null;
        try {
            const pdfRaw = await this.http.post('getAWBPdf', credentials, { awb: trimmed });
            const pdfBase64 = (typeof pdfRaw?.pdf === 'string' && pdfRaw.pdf) ||
                (typeof pdfRaw?.content === 'string' && pdfRaw.content) ||
                (typeof pdfRaw?.data === 'string' && pdfRaw.data) ||
                '';
            if (pdfBase64.trim()) {
                return { pdfBase64: pdfBase64.trim(), contentType: 'application/pdf' };
            }
        }
        catch {
        }
        try {
            const linkRaw = await this.http.post('getAWBLink', credentials, { awb: trimmed });
            const url = (typeof linkRaw?.url === 'string' && linkRaw.url) ||
                (typeof linkRaw?.link === 'string' && linkRaw.link) ||
                (typeof linkRaw?.awbLink === 'string' && linkRaw.awbLink) ||
                '';
            if (url.trim()) {
                return { url: url.trim() };
            }
        }
        catch {
        }
        return null;
    }
};
exports.BabelExpressAdapter = BabelExpressAdapter;
exports.BabelExpressAdapter = BabelExpressAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [babel_express_http_client_1.BabelExpressHttpClient])
], BabelExpressAdapter);
//# sourceMappingURL=babel-express.adapter.js.map