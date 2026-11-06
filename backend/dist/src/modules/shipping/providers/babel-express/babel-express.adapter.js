"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BabelExpressAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelExpressAdapter = exports.BABEL_WEBHOOK_KEY_MIN_LENGTH = exports.BABEL_EVENT_DESCRIPTIONS = exports.BABEL_WEBHOOK_EVENTS = void 0;
exports.generateBabelWebhookKey = generateBabelWebhookKey;
exports.babelWebhookSignature = babelWebhookSignature;
const crypto = __importStar(require("crypto"));
const common_1 = require("@nestjs/common");
const provider_request_log_1 = require("../../provider-request-log");
const shipping_constants_1 = require("../../shipping.constants");
const shipping_lookup_util_1 = require("../../shipping-lookup.util");
const babel_express_http_client_1 = require("./babel-express.http-client");
const babel_shipment_mapper_1 = require("./babel-shipment.mapper");
function deliveryTypeLabel(type) {
    return type === 'hub' ? 'Hub' : 'Address';
}
exports.BABEL_WEBHOOK_EVENTS = [
    'ChangedReceiver',
    'ArrivedToHub',
    'EnRoute',
    'DeliveryContact',
    'DeliveryFailed',
    'CreatedFollowupShipment',
    'OutForDelivery',
    'Delivered',
    'ReturnedToSender',
    'Disposed',
    'ShipmentLost',
];
exports.BABEL_EVENT_DESCRIPTIONS = {
    Created: 'تم تكوين الشحنة',
    ArrivedToHub: 'وصلت الشحنة الى نقطة التحويل',
    EnRoute: 'الشحنة ضمن النقل',
    OutForDelivery: 'خرجت الشحنة للتسليم',
    Delivered: 'تم تسليم الشحنة',
    DeliveryFailed: 'فشل تسليم الشحنة',
    DeliveryContact: 'الاتصال بالمستلم لتحديد التسليم',
    CreatedFollowupShipment: 'تم تكوين شحنة متابعة',
    ReturnedToSender: 'تمت الاعادة الى المرسل',
    ChangedReceiver: 'تم تغيير المستلم',
    Disposed: 'تم إتلاف الشحنة',
    ShipmentLost: 'فقدان الشحنة',
};
exports.BABEL_WEBHOOK_KEY_MIN_LENGTH = 32;
function generateBabelWebhookKey() {
    return crypto.randomBytes(32).toString('hex');
}
function babelWebhookSignature(awb, type, key) {
    return crypto.createHash('sha256').update(`${awb}|${type}|${key}`).digest('hex');
}
let BabelExpressAdapter = BabelExpressAdapter_1 = class BabelExpressAdapter {
    http;
    logger = new common_1.Logger(BabelExpressAdapter_1.name);
    code = shipping_constants_1.BABEL_EXPRESS_CODE;
    capabilities = {
        supportsQuote: true,
        supportsLabelPrinting: true,
        labelDelivery: 'api',
        supportsTracking: true,
        supportsWebhooks: true,
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
                pickupType: (0, babel_shipment_mapper_1.resolveBabelPickupType)(input.pickupType),
                pickup: input.pickup,
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
            pickupType: (0, babel_shipment_mapper_1.resolveBabelPickupType)(input.pickupType),
            pickup: input.pickup,
        });
        const preflight = await this.http.post('calculatePrice', credentials, preflightPayload);
        if (!(0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(preflight, deliveryType)) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express does not offer a shippable service for this destination and options (quote response indicates no service).', undefined, preflight);
        }
        const payload = (0, babel_shipment_mapper_1.mapCreateShipmentPayload)({
            ...input,
            deliveryType,
            pickupType: (0, babel_shipment_mapper_1.resolveBabelPickupType)(input.pickupType),
            currency: input.currency,
            receiver: {
                ...input.receiver,
                neighbourhoodId,
            },
        });
        (0, provider_request_log_1.logSanitizedProviderRequest)(this.logger, (0, provider_request_log_1.sanitizeBabelCreatePayload)(payload));
        const raw = await this.http.post('createShipment', credentials, payload);
        const awb = typeof raw?.awb === 'string' ? raw.awb.trim() : '';
        if (!awb) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express createShipment succeeded without awb.', undefined, raw);
        }
        const partBarcodes = Array.isArray(raw?.partBarcodes)
            ? raw.partBarcodes
                .filter((b) => typeof b === 'string' && Boolean(b.trim()))
                .map((b) => b.trim())
            : undefined;
        return { awb, partBarcodes, raw };
    }
    async getQuote(credentials, input) {
        let neighbourhoodId = input.neighbourhoodId;
        const lat = Number(input.receiverLat);
        const lng = Number(input.receiverLng);
        const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0 && Math.abs(lng) > 0;
        if (neighbourhoodId == null && !hasPin) {
            throw new babel_express_http_client_1.BabelApiError('Babel calculatePrice was not sent: the request has no neighbourhood id and no coordinates.');
        }
        if (neighbourhoodId == null) {
            neighbourhoodId = await this.lookupNeighbourhoodId(credentials, lat, lng);
        }
        const requestQuote = async (deliveryType) => {
            const payload = (0, babel_shipment_mapper_1.mapCalculatePricePayload)({
                ...input,
                neighbourhoodId,
                deliveryType,
                pickupType: (0, babel_shipment_mapper_1.resolveBabelPickupType)(input.pickupType),
                pickup: input.pickup,
            });
            return this.http.post('calculatePrice', credentials, payload);
        };
        const raw = await requestQuote(input.deliveryType);
        const effectiveDeliveryType = input.deliveryType;
        const shippable = (0, babel_shipment_mapper_1.isBabelCalculatePriceShippable)(raw, effectiveDeliveryType);
        if (!shippable) {
            throw new babel_express_http_client_1.BabelApiError(`Babel calculatePrice did not offer ${input.deliveryType}: ${JSON.stringify(raw)}`, undefined, raw);
        }
        const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
        if (!Number.isFinite(price)) {
            throw new babel_express_http_client_1.BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
        }
        const rawCurrency = typeof raw?.currency === 'string' ? raw.currency : 'SYP';
        const currency = rawCurrency.trim().toUpperCase() === 'SYP' && typeof raw?.isNewSYP === 'boolean'
            ? raw.isNewSYP
                ? 'SYP_NEW'
                : 'SYP_OLD'
            : rawCurrency;
        return {
            price,
            currency,
            details: raw?.details,
            effectiveDeliveryType,
            serviceName: deliveryTypeLabel(effectiveDeliveryType),
            shippable: true,
            neighbourhoodId,
        };
    }
    async getServiceOptions(credentials, input) {
        const types = ['address', 'hub'];
        const results = [];
        const omitted = [];
        for (const deliveryType of types) {
            try {
                const quote = await this.getQuote(credentials, { ...input, deliveryType });
                const effectiveType = quote.effectiveDeliveryType ?? deliveryType;
                if (results.some((r) => (r.effectiveDeliveryType ?? r.serviceId) === effectiveType || r.serviceId === `${shipping_constants_1.BABEL_EXPRESS_CODE}:${effectiveType}`)) {
                    continue;
                }
                results.push({
                    ...quote,
                    effectiveDeliveryType: effectiveType,
                    serviceId: `${shipping_constants_1.BABEL_EXPRESS_CODE}:${effectiveType}`,
                    serviceName: effectiveType === 'hub'
                        ? 'بابل إكسبريس — فرع (Babel Hub)'
                        : 'بابل إكسبريس — منزلي (Babel Home)',
                    providerName: 'Babel Express',
                    estimatedDeliveryMin: 2,
                    estimatedDeliveryMax: 3,
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                omitted.push(message);
                this.logger.warn(`Babel ${deliveryType} quote omitted: ${message}`);
            }
        }
        if (results.length === 0 && omitted.length > 0) {
            throw new babel_express_http_client_1.BabelApiError(omitted[0]);
        }
        return results;
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
    verifyWebhook(_headers, body, secret) {
        let parsed = body;
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
            try {
                parsed = JSON.parse(typeof body === 'string' ? body : body.toString('utf8'));
            }
            catch {
                return false;
            }
        }
        if (!parsed || typeof parsed !== 'object')
            return false;
        const b = parsed;
        if (b.type === 'test')
            return true;
        if (!secret || !secret.trim())
            return false;
        const { awb, type, verify } = b;
        if (!verify || !awb || !type)
            return false;
        const expected = babelWebhookSignature(String(awb), String(type), secret.trim());
        return String(verify).toLowerCase() === expected.toLowerCase();
    }
    normalizeWebhook(_headers, body) {
        if (!body || typeof body !== 'object')
            return null;
        const b = body;
        if (b.type === 'test')
            return null;
        const awb = typeof b.awb === 'string' ? b.awb.trim() : '';
        const type = typeof b.type === 'string' ? b.type.trim() : '';
        if (!awb || !type)
            return null;
        const details = b.details && typeof b.details === 'object' ? b.details : {};
        let normalizedStatus = 'unknown';
        let carrierReturnStage;
        switch (type) {
            case 'ArrivedToHub':
            case 'EnRoute':
            case 'InTransit':
            case 'ChangedReceiver':
                normalizedStatus = 'in_transit';
                break;
            case 'OutForDelivery':
                normalizedStatus = 'out_for_delivery';
                break;
            case 'Delivered':
                normalizedStatus = 'delivered';
                break;
            case 'DeliveryFailed':
                normalizedStatus = 'delivery_failed';
                break;
            case 'DeliveryContact':
                normalizedStatus = 'unknown';
                break;
            case 'CreatedFollowupShipment': {
                const followupType = typeof details.followupType === 'string' ? details.followupType.trim() : '';
                if (followupType === 'return') {
                    normalizedStatus = 'return_created';
                    carrierReturnStage = 'return_created';
                }
                else {
                    normalizedStatus = 'unknown';
                }
                break;
            }
            case 'ReturnedToSender':
                normalizedStatus = 'returned_to_sender';
                carrierReturnStage = 'returned_to_sender';
                break;
            case 'Disposed':
            case 'ShipmentLost':
                normalizedStatus = 'unknown';
                break;
        }
        const time = typeof b.time === 'number' ? b.time : null;
        const timestamp = time ? new Date(time * 1000) : new Date();
        const locationText = details.name || details.location || undefined;
        const notes = details.reason || details.note || details.followupType || undefined;
        const returnReason = (typeof details.reason === 'string' && details.reason.trim())
            || (typeof details.note === 'string' && details.note.trim())
            || undefined;
        const originalCarrierStatus = String(b.type || b.status || b.statusText || type);
        const explicitText = typeof details.text === 'string' && details.text.trim()
            ? details.text.trim()
            : typeof b.text === 'string' && b.text.trim()
                ? b.text.trim()
                : null;
        const defaultDesc = exports.BABEL_EVENT_DESCRIPTIONS[type] || type;
        const eventDescription = explicitText
            || (details.note
                ? `${defaultDesc} - ${details.note}`
                : details.reason
                    ? `${defaultDesc} - ${details.reason}`
                    : defaultDesc);
        return {
            providerCode: this.code,
            externalEventId: `${awb}:${type}:${time ?? Date.now()}`,
            awb,
            eventType: type,
            normalizedStatus,
            timestamp,
            locationText,
            notes,
            returnReason,
            originalCarrierStatus: type,
            eventDescription,
            sourceType: 'webhook',
            isCarrierEvent: true,
            carrierReturnStage,
            reference: typeof b.reference === 'string' ? b.reference.trim() : undefined,
            rawPayload: b,
        };
    }
    async pollTracking(credentials, awb) {
        const trimmed = awb.trim();
        if (!trimmed)
            return null;
        try {
            const res = await this.http.post('trackShipment', credentials, { awb: trimmed });
            if (res?.status !== 'success' || !res?.tracking) {
                if ((0, shipping_lookup_util_1.isBabelShipmentNotFoundMessage)(res?.errorMessage)) {
                    return this.lookupNotFoundEvent(trimmed, res?.errorMessage);
                }
                return null;
            }
            const t = res.tracking;
            let normalizedStatus = 'in_transit';
            let carrierReturnStage;
            if (t.isDelivered) {
                normalizedStatus = 'delivered';
            }
            else {
                const updates = Array.isArray(t.updates) ? t.updates : [];
                const lastUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
                const text = (lastUpdate?.text || t.shipmentStatus?.text || '').trim();
                if (text.includes('تسليم الشحنة') || text.includes('تم التسليم')) {
                    normalizedStatus = 'delivered';
                }
                else if (text.includes('خرجت الشحنة للتسليم') || text.includes('للتسليم')) {
                    normalizedStatus = 'out_for_delivery';
                }
                else if (text.includes('تم ارجاع الشحنة الى المرسل') ||
                    text.includes('عادت الى المرسل') ||
                    text.includes('تسليم المرتجع للمرسل')) {
                    normalizedStatus = 'returned_to_sender';
                    carrierReturnStage = 'returned_to_sender';
                }
                else if (text.includes('قيد الارجاع') ||
                    text.includes('جاري اعادة الشحنة') ||
                    text.includes('في طريق العودة')) {
                    normalizedStatus = 'returning_to_sender';
                    carrierReturnStage = 'returning_to_sender';
                }
                else if (text.includes('انشاء بوليصة مرتجع') ||
                    text.includes('طلب ارجاع') ||
                    text.includes('تكوين شحنة مرتجعة')) {
                    normalizedStatus = 'return_created';
                    carrierReturnStage = 'return_created';
                }
                else if (text.includes('ارجاع') || text.includes('عادت') || text.includes('مرتجع')) {
                    normalizedStatus = 'returning_to_sender';
                    carrierReturnStage = 'returning_to_sender';
                }
                else if (text.includes('فشل الاتصال') ||
                    text.includes('لم يتم الرد') ||
                    text.includes('غير متاح') ||
                    text.includes('تأجيل')) {
                    normalizedStatus = 'unknown';
                }
                else if (text.includes('فشل') || text.includes('تعذر')) {
                    normalizedStatus = 'delivery_failed';
                }
                else if (text.includes('وصلت') || text.includes('تكوين') || text.includes('تحويل')) {
                    normalizedStatus = 'in_transit';
                }
            }
            const rawStatusText = t.shipmentStatus?.text || 'TRACKING_UPDATE';
            const rawStatusCode = t.shipmentStatus?.code || rawStatusText;
            const updates = Array.isArray(t.updates) ? t.updates : [];
            const lastUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
            const updateTime = lastUpdate?.time ? Number(lastUpdate.time) : null;
            const timestamp = t.deliverDate
                ? new Date(t.deliverDate * 1000)
                : updateTime && Number.isFinite(updateTime)
                    ? new Date(updateTime * 1000)
                    : new Date();
            const eventDescription = lastUpdate?.text || rawStatusText;
            return {
                providerCode: this.code,
                awb: trimmed,
                eventType: rawStatusCode,
                normalizedStatus,
                carrierReturnStage,
                originalCarrierStatus: rawStatusCode,
                eventDescription,
                sourceType: 'poll',
                isCarrierEvent: true,
                timestamp,
                locationText: lastUpdate?.location || undefined,
                rawPayload: res,
            };
        }
        catch (err) {
            if ((0, shipping_lookup_util_1.isBabelShipmentNotFoundMessage)(err?.message)) {
                return this.lookupNotFoundEvent(trimmed, err?.message);
            }
            return null;
        }
    }
    lookupNotFoundEvent(awb, errorMessage) {
        const message = (errorMessage || 'Shipment not found').trim();
        return {
            providerCode: this.code,
            awb,
            externalEventId: `${shipping_lookup_util_1.PROVIDER_LOOKUP_NOT_FOUND_EVENT}:${awb}`,
            eventType: shipping_lookup_util_1.PROVIDER_LOOKUP_NOT_FOUND_EVENT,
            normalizedStatus: 'unknown',
            originalCarrierStatus: message,
            eventDescription: message,
            sourceType: 'poll',
            isCarrierEvent: true,
            notes: message,
            timestamp: new Date(),
            rawPayload: { lookupState: 'not_found', errorMessage: message },
        };
    }
    async getTrackingHistory(credentials, awb) {
        const trimmed = awb.trim();
        if (!trimmed)
            return null;
        try {
            const res = await this.http.post('trackShipment', credentials, { awb: trimmed });
            if (res?.status !== 'success' || !res?.tracking) {
                const notFound = (0, shipping_lookup_util_1.isBabelShipmentNotFoundMessage)(res?.errorMessage);
                return {
                    providerCode: this.code,
                    providerName: 'Babel Express',
                    awb: trimmed,
                    events: [],
                    lookupState: notFound ? 'not_found' : 'error',
                    cancellationUnconfirmed: notFound,
                    shipmentState: 'active',
                    message: notFound
                        ? 'The carrier did not return this shipment. Cancellation is not confirmed.'
                        : res?.errorMessage || 'No tracking information available for this shipment.',
                    error: notFound ? undefined : res?.errorMessage,
                };
            }
            const t = res.tracking;
            const rawUpdates = Array.isArray(t.updates) ? t.updates : [];
            const events = rawUpdates.map((u) => {
                let color = 'default';
                const rawColor = String(u.color || '').toLowerCase().trim();
                if (rawColor === 'success')
                    color = 'success';
                else if (rawColor === 'error' || rawColor === 'danger')
                    color = 'error';
                else if (rawColor === 'info')
                    color = 'info';
                else if (rawColor === 'warning')
                    color = 'warning';
                const timeSeconds = typeof u.time === 'number' ? u.time : Number(u.time);
                const timestamp = Number.isFinite(timeSeconds) && timeSeconds > 0
                    ? new Date(timeSeconds * 1000).toISOString()
                    : new Date().toISOString();
                return {
                    timestamp,
                    title: typeof u.text === 'string' && u.text.trim() ? u.text.trim() : (u.code || ''),
                    location: typeof u.location === 'string' && u.location.trim() ? u.location.trim() : null,
                    color,
                    code: typeof u.code === 'string' ? u.code : null,
                    source: 'carrier',
                    originalDescription: typeof u.text === 'string' ? u.text.trim() : null,
                };
            });
            events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return {
                providerCode: this.code,
                providerName: 'Babel Express',
                awb: trimmed,
                isDelivered: Boolean(t.isDelivered),
                statusLabel: t.shipmentStatus?.text || undefined,
                statusColor: t.shipmentStatus?.color || undefined,
                lookupState: 'ok',
                shipmentState: 'active',
                cancellationUnconfirmed: false,
                events,
            };
        }
        catch (err) {
            const message = err?.message || 'Failed to query Babel Express tracking API.';
            const notFound = (0, shipping_lookup_util_1.isBabelShipmentNotFoundMessage)(message);
            return {
                providerCode: this.code,
                providerName: 'Babel Express',
                awb: trimmed,
                events: [],
                lookupState: notFound ? 'not_found' : 'error',
                cancellationUnconfirmed: notFound,
                shipmentState: 'active',
                message: notFound
                    ? 'The carrier did not return this shipment. Cancellation is not confirmed.'
                    : undefined,
                error: notFound ? undefined : message,
            };
        }
    }
    async registerWebhook(credentials, webhookUrl, secret) {
        const key = secret.trim().length >= exports.BABEL_WEBHOOK_KEY_MIN_LENGTH
            ? secret.trim()
            : generateBabelWebhookKey();
        try {
            const payload = {
                webhook: {
                    enabled: true,
                    key,
                    url: webhookUrl,
                    subscribedEvents: [...exports.BABEL_WEBHOOK_EVENTS],
                },
            };
            const res = await this.http.post('registerWebhook', credentials, payload);
            if (res?.status === 'success') {
                return {
                    ok: true,
                    secret: key,
                    message: 'Babel Express webhook registered. Provider returned status=success after the documented test POST to the callback URL.',
                };
            }
            return { ok: false, message: res?.errorMessage || 'Failed to register webhook with Babel Express.' };
        }
        catch (err) {
            return { ok: false, message: err?.message || 'Error communicating with Babel Express registerWebhook.' };
        }
    }
    async cancelShipment(_credentials, _providerId) {
        return {
            outcome: 'refused',
            errorCode: 'cancel_unsupported',
            message: 'Babel Express API does not support automated cancellation via API. Please cancel the shipment directly in the Babel merchant portal.',
        };
    }
};
exports.BabelExpressAdapter = BabelExpressAdapter;
exports.BabelExpressAdapter = BabelExpressAdapter = BabelExpressAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [babel_express_http_client_1.BabelExpressHttpClient])
], BabelExpressAdapter);
//# sourceMappingURL=babel-express.adapter.js.map