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
function deliveryTypeLabel(type) {
    return type === 'hub' ? 'Hub' : 'Address';
}
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
        const neighbourhoodId = input.receiver.neighbourhoodId ??
            (await this.lookupNeighbourhoodId(credentials, input.receiver.lat, input.receiver.lng));
        let deliveryType = input.deliveryType;
        if (deliveryType === 'address') {
            const probe = (0, babel_shipment_mapper_1.mapCalculatePricePayload)({
                receiverLat: input.receiver.lat,
                receiverLng: input.receiver.lng,
                neighbourhoodId,
                packageType: input.packageType,
                weightKg: input.weightKg,
                parts: input.parts,
                deliveryType: 'address',
                pickupType: 'hub',
            });
            const probeRaw = await this.http.post('calculatePrice', credentials, probe);
            if (!(0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(probeRaw, 'address')) {
                deliveryType = 'hub';
            }
        }
        const preflightPayload = (0, babel_shipment_mapper_1.mapCalculatePricePayload)({
            receiverLat: input.receiver.lat,
            receiverLng: input.receiver.lng,
            neighbourhoodId,
            packageType: input.packageType,
            weightKg: input.weightKg,
            parts: input.parts,
            deliveryType,
            pickupType: 'hub',
        });
        const preflight = await this.http.post('calculatePrice', credentials, preflightPayload);
        if (!(0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(preflight, deliveryType)) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express does not offer a shippable service for this destination and options (quote response indicates no service).', undefined, preflight);
        }
        const payload = (0, babel_shipment_mapper_1.mapCreateShipmentPayload)({
            ...input,
            deliveryType,
            pickupType: (0, babel_shipment_mapper_1.resolveBabelPickupType)(input.pickupType),
            currency: (0, babel_shipment_mapper_1.resolveBabelCodCurrency)(input.currency),
            receiver: {
                ...input.receiver,
                neighbourhoodId,
            },
        });
        const raw = await this.http.post('createShipment', credentials, payload);
        const awb = typeof raw?.awb === 'string' ? raw.awb.trim() : '';
        if (!awb) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express createShipment succeeded without awb.', undefined, raw);
        }
        return { awb, raw };
    }
    async getQuote(credentials, input) {
        let neighbourhoodId = input.neighbourhoodId;
        if (neighbourhoodId == null) {
            neighbourhoodId = await this.lookupNeighbourhoodId(credentials, input.receiverLat, input.receiverLng);
        }
        const requestQuote = async (deliveryType) => {
            const payload = (0, babel_shipment_mapper_1.mapCalculatePricePayload)({
                ...input,
                neighbourhoodId,
                deliveryType,
                pickupType: 'hub',
            });
            return this.http.post('calculatePrice', credentials, payload);
        };
        let raw = await requestQuote(input.deliveryType);
        let effectiveDeliveryType = input.deliveryType;
        let restrictions;
        if (input.deliveryType === 'address' &&
            !(0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(raw, 'address')) {
            raw = await requestQuote('hub');
            effectiveDeliveryType = 'hub';
            restrictions = [
                'Door delivery is not available at this pin. Hub delivery applies (customer collects from a Babel hub).',
            ];
        }
        const shippable = (0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(raw, effectiveDeliveryType);
        if (!shippable) {
            throw new babel_express_http_client_1.BabelApiError('Not available for this destination / shipment configuration (Babel returned a non-shippable quote).', undefined, raw);
        }
        const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
        if (!Number.isFinite(price)) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
        }
        const currency = typeof raw?.currency === 'string' ? raw.currency : 'SYP';
        return {
            price,
            currency,
            details: raw?.details,
            effectiveDeliveryType,
            serviceName: deliveryTypeLabel(effectiveDeliveryType),
            restrictions,
            shippable: true,
            neighbourhoodId,
        };
    }
    async getServiceOptions(credentials, input) {
        let neighbourhoodId = input.neighbourhoodId;
        if (neighbourhoodId == null) {
            neighbourhoodId = await this.lookupNeighbourhoodId(credentials, input.receiverLat, input.receiverLng);
        }
        const options = [];
        for (const deliveryType of ['address', 'hub']) {
            const payload = (0, babel_shipment_mapper_1.mapCalculatePricePayload)({
                ...input,
                neighbourhoodId,
                deliveryType,
                pickupType: 'hub',
            });
            try {
                const raw = await this.http.post('calculatePrice', credentials, payload);
                if (!(0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(raw, deliveryType))
                    continue;
                const price = typeof raw.price === 'number' ? raw.price : Number(raw.price);
                if (!Number.isFinite(price))
                    continue;
                options.push({
                    price,
                    currency: typeof raw.currency === 'string' ? raw.currency : 'SYP',
                    details: raw.details,
                    effectiveDeliveryType: deliveryType,
                    serviceId: `${shipping_constants_1.BABEL_EXPRESS_CODE}:${deliveryType}`,
                    serviceName: deliveryTypeLabel(deliveryType),
                    shippable: true,
                    neighbourhoodId,
                });
            }
            catch {
            }
        }
        return options;
    }
    async lookupNeighbourhoodId(credentials, lat, lng) {
        const raw = await this.http.post('findNeighbourhoodByCoordinates', credentials, {
            coordinates: { lat, lng },
        });
        const id = raw?.neighbourhood?.id;
        if (typeof id !== 'number' || !Number.isFinite(id)) {
            throw new babel_express_http_client_1.BabelApiError('Could not resolve the delivery neighbourhood from the map coordinates.');
        }
        return id;
    }
    async findNeighbourhoodByCoordinates(credentials, lat, lng) {
        try {
            const raw = await this.http.post('findNeighbourhoodByCoordinates', credentials, {
                coordinates: { lat, lng },
            });
            const id = raw?.neighbourhood?.id;
            const name = raw?.neighbourhood?.name;
            if (typeof id !== 'number' || !Number.isFinite(id))
                return null;
            return { id, name: typeof name === 'string' ? name : String(id) };
        }
        catch {
            return null;
        }
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