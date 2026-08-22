"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBabelCalculatePriceShippable = exports.isBabelAddressDeliveryAvailable = void 0;
exports.resolveBabelPickupType = resolveBabelPickupType;
exports.resolveBabelCodCurrency = resolveBabelCodCurrency;
exports.mapCreateShipmentPayload = mapCreateShipmentPayload;
exports.mapCalculatePricePayload = mapCalculatePricePayload;
exports.parsePhoneForBabel = parsePhoneForBabel;
const shipping_config_util_1 = require("../../shipping-config.util");
var babel_quote_util_1 = require("./babel-quote.util");
Object.defineProperty(exports, "isBabelAddressDeliveryAvailable", { enumerable: true, get: function () { return babel_quote_util_1.isBabelAddressDeliveryAvailable; } });
var babel_quote_util_2 = require("./babel-quote.util");
Object.defineProperty(exports, "isBabelCalculatePriceShippable", { enumerable: true, get: function () { return babel_quote_util_2.isBabelCalculatePriceShippable; } });
function resolveBabelPickupType(pickupType) {
    return pickupType === 'address' ? 'hub' : pickupType;
}
function resolveBabelCodCurrency(currency) {
    const normalized = currency?.trim().toUpperCase();
    if (normalized === 'USD' || normalized === 'SYP')
        return normalized;
    return 'USD';
}
function resolveParts(input) {
    if (input.packageType === 'envelope') {
        return [{ weight: 1 }];
    }
    if (input.parts && input.parts.length > 0) {
        return input.parts.map((p) => ({
            weight: Math.max(0.1, Number(p.weight) || 0.1),
        }));
    }
    const w = Number(input.weightKg);
    return [{ weight: Number.isFinite(w) && w > 0 ? w : 0.1 }];
}
function resolveNeighbourhood(input) {
    if (input.neighbourhoodId != null && Number.isFinite(Number(input.neighbourhoodId))) {
        return { id: Number(input.neighbourhoodId) };
    }
    const lat = input.lat ?? input.receiverLat;
    const lng = input.lng ?? input.receiverLng;
    return {
        coordinates: {
            lat: Number(lat),
            lng: Number(lng),
        },
    };
}
function mapCreateShipmentPayload(input) {
    const neighbourhood = resolveNeighbourhood({
        neighbourhoodId: input.receiver.neighbourhoodId,
        lat: input.receiver.lat,
        lng: input.receiver.lng,
    });
    return {
        shipment: {
            receiver: {
                name: input.receiver.name,
                phone: {
                    country: input.receiver.phoneCountry,
                    phone: input.receiver.phoneLocal,
                },
                address: input.receiver.address,
                neighbourhood,
            },
            type: input.packageType,
            parts: resolveParts(input),
            contents: input.contents,
            deliveryType: input.deliveryType,
            pickupType: resolveBabelPickupType(input.pickupType),
            cod: {
                amount: input.codAmount,
                currency: resolveBabelCodCurrency(input.currency),
            },
            payer: input.payer,
            ...(input.reference ? { reference: input.reference } : {}),
        },
    };
}
function mapCalculatePricePayload(input) {
    const neighbourhood = resolveNeighbourhood({
        neighbourhoodId: input.neighbourhoodId,
        receiverLat: input.receiverLat,
        receiverLng: input.receiverLng,
    });
    const parts = input.parts && input.parts.length > 0
        ? input.parts.map((p) => ({ weight: Math.max(0.1, Number(p.weight) || 0.1) }))
        : resolveParts({
            packageType: input.packageType,
            weightKg: input.weightKg,
            parts: undefined,
        });
    return {
        delivery: {
            receiver: {
                neighbourhood,
            },
            type: input.packageType,
            parts: input.packageType === 'envelope' ? [{ weight: 1 }] : parts,
            deliveryType: input.deliveryType,
            pickupType: resolveBabelPickupType(input.pickupType ?? 'hub'),
        },
    };
}
function parsePhoneForBabel(recipientPhone, shippingPhoneCountry) {
    const countryHint = (0, shipping_config_util_1.normalizeShippingPhoneCountry)(shippingPhoneCountry);
    const raw = (recipientPhone ?? '').trim();
    if (!raw && !countryHint)
        return null;
    const digits = raw.replace(/[^\d+]/g, '');
    let local = digits.replace(/^\+/, '');
    if (countryHint) {
        if (local.startsWith(countryHint)) {
            local = local.slice(countryHint.length);
        }
        local = local.replace(/^0+/, '');
        if (!local)
            return null;
        return { country: countryHint, phone: local };
    }
    if (local.startsWith('00963'))
        local = local.slice(5);
    else if (local.startsWith('963'))
        local = local.slice(3);
    else if (local.startsWith('0') && local.length >= 9) {
        return { country: '963', phone: local.replace(/^0+/, '') };
    }
    else if (local.length >= 7) {
        return { country: '963', phone: local.replace(/^0+/, '') };
    }
    else {
        return null;
    }
    local = local.replace(/^0+/, '');
    if (!local)
        return null;
    return { country: '963', phone: local };
}
//# sourceMappingURL=babel-shipment.mapper.js.map