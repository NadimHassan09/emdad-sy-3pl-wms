"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCreateShipmentPayload = mapCreateShipmentPayload;
exports.mapCalculatePricePayload = mapCalculatePricePayload;
exports.parsePhoneForBabel = parsePhoneForBabel;
const shipping_config_util_1 = require("../../shipping-config.util");
function mapCreateShipmentPayload(input) {
    return {
        shipment: {
            receiver: {
                name: input.receiver.name,
                phone: {
                    country: input.receiver.phoneCountry,
                    phone: input.receiver.phoneLocal,
                },
                address: input.receiver.address,
                neighbourhood: {
                    coordinates: {
                        lat: input.receiver.lat,
                        lng: input.receiver.lng,
                    },
                },
            },
            type: input.packageType,
            parts: [{ weight: input.weightKg }],
            contents: input.contents,
            deliveryType: input.deliveryType,
            pickupType: input.pickupType,
            cod: {
                amount: input.codAmount,
                ...(input.currency ? { currency: input.currency } : {}),
            },
            payer: input.payer,
            ...(input.reference ? { reference: input.reference } : {}),
        },
    };
}
function mapCalculatePricePayload(input) {
    return {
        delivery: {
            receiver: {
                neighbourhood: {
                    coordinates: {
                        lat: input.receiverLat,
                        lng: input.receiverLng,
                    },
                },
            },
            type: input.packageType,
            parts: [{ weight: input.weightKg }],
            deliveryType: input.deliveryType,
            ...(input.pickupType ? { pickupType: input.pickupType } : {}),
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
    else {
        return null;
    }
    local = local.replace(/^0+/, '');
    if (!local)
        return null;
    return { country: '963', phone: local };
}
//# sourceMappingURL=babel-shipment.mapper.js.map