"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOrderVolume = exports.calculateOrderWeight = exports.BABEL_MAX_BOX_WEIGHT_KG = exports.SHIPPING_IDENTITY_LOCKED_STATUSES = exports.SHIPPING_LOCKED_STATUSES = void 0;
exports.isShippingConfigLocked = isShippingConfigLocked;
exports.assertShippingConfigUnlocked = assertShippingConfigUnlocked;
exports.assertShippingIntentReady = assertShippingIntentReady;
exports.assertCarrierShippingReady = assertCarrierShippingReady;
exports.assertShippingPhoneCountry = assertShippingPhoneCountry;
exports.normalizeShippingPhoneCountry = normalizeShippingPhoneCountry;
exports.shippingPrismaData = shippingPrismaData;
exports.copyShippingFieldsFromOms = copyShippingFieldsFromOms;
exports.hasShippingConfigPatch = hasShippingConfigPatch;
exports.sumLineWeightsKg = sumLineWeightsKg;
exports.sumLineVolumesCbm = sumLineVolumesCbm;
exports.resolveShippingWeightKg = resolveShippingWeightKg;
exports.resolveShippingVolumeCbm = resolveShippingVolumeCbm;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.SHIPPING_LOCKED_STATUSES = new Set([
    'ready_to_ship',
    'shipped',
    'delivered',
    'cancelled',
    'failed_delivery',
    'returned',
]);
exports.SHIPPING_IDENTITY_LOCKED_STATUSES = new Set([
    'ready_to_ship',
    'shipped',
    'delivered',
    'cancelled',
    'failed_delivery',
    'returned',
]);
function isShippingConfigLocked(outboundStatus) {
    if (!outboundStatus)
        return false;
    return exports.SHIPPING_LOCKED_STATUSES.has(outboundStatus);
}
function assertShippingConfigUnlocked(outboundStatus) {
    if (isShippingConfigLocked(outboundStatus)) {
        throw new common_1.BadRequestException('Shipping settings are locked after the order reaches ready_to_ship (Waiting for Dispatch).');
    }
}
function assertShippingIntentReady(fields) {
    if ((fields.shippingMethod ?? client_1.ShippingMethod.manual) !== client_1.ShippingMethod.carrier) {
        return;
    }
    if (!fields.shippingProviderCode?.trim()) {
        throw new common_1.BadRequestException('shippingProviderCode is required when shippingMethod=carrier.');
    }
}
exports.BABEL_MAX_BOX_WEIGHT_KG = 200;
function assertCarrierShippingReady(fields) {
    if ((fields.shippingMethod ?? client_1.ShippingMethod.manual) !== client_1.ShippingMethod.carrier) {
        return;
    }
    assertShippingIntentReady(fields);
    if (fields.shippingReceiverLat == null || fields.shippingReceiverLng == null) {
        throw new common_1.BadRequestException('Receiver lat/lng are required when shipping via a carrier.');
    }
    const lat = Number(fields.shippingReceiverLat);
    const lng = Number(fields.shippingReceiverLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new common_1.BadRequestException('Receiver lat/lng must be valid numbers.');
    }
    if (!fields.shippingPackageType) {
        throw new common_1.BadRequestException('shippingPackageType is required when shipping via a carrier.');
    }
    if (!fields.shippingContents?.trim()) {
        throw new common_1.BadRequestException('shippingContents is required when shipping via a carrier.');
    }
    if (!fields.shippingDeliveryType) {
        throw new common_1.BadRequestException('shippingDeliveryType is required when shipping via a carrier.');
    }
    if (!fields.shippingPickupType) {
        throw new common_1.BadRequestException('shippingPickupType is required when shipping via a carrier.');
    }
    if (!fields.shippingPayer) {
        throw new common_1.BadRequestException('shippingPayer is required when shipping via a carrier.');
    }
    const weight = Number(fields.shippingWeightKg);
    if (fields.shippingWeightKg == null || !Number.isFinite(weight) || weight <= 0) {
        throw new common_1.BadRequestException('shippingWeightKg must be a positive number when shipping via a carrier.');
    }
    if (fields.shippingPackageType === client_1.ShippingPackageType.envelope && weight !== 1) {
        throw new common_1.BadRequestException('Envelope shipments must weigh exactly 1 kg (Babel Express rule).');
    }
    if (fields.shippingPackageType === client_1.ShippingPackageType.box && weight > exports.BABEL_MAX_BOX_WEIGHT_KG) {
        throw new common_1.BadRequestException(`Shipment weight ${weight} kg is too high for Babel Express (max ${exports.BABEL_MAX_BOX_WEIGHT_KG} kg for a box). Enter the actual package weight in kilograms — not COD amount or currency.`);
    }
    if (fields.shippingPhoneCountry != null && fields.shippingPhoneCountry.trim() !== '') {
        assertShippingPhoneCountry(fields.shippingPhoneCountry);
    }
}
function assertShippingPhoneCountry(raw) {
    const normalized = normalizeShippingPhoneCountry(raw);
    if (!normalized) {
        throw new common_1.BadRequestException('Phone country must be a dial code (e.g. 963) or SY — not an amount or postal code.');
    }
}
function normalizeShippingPhoneCountry(raw) {
    if (raw == null)
        return null;
    const t = raw.trim();
    if (!t)
        return null;
    const upper = t.toUpperCase();
    if (upper === 'SY' || upper === 'SYR' || upper === 'SYRIA')
        return '963';
    const digits = t.replace(/\D/g, '');
    if (!digits || digits.length < 1 || digits.length > 4)
        return null;
    if (Number(digits) >= 1000)
        return null;
    return digits;
}
function shippingPrismaData(fields) {
    const data = {};
    if (fields.shippingMethod !== undefined)
        data.shippingMethod = fields.shippingMethod;
    if (fields.shippingProviderCode !== undefined) {
        data.shippingProviderCode = fields.shippingProviderCode;
    }
    if (fields.shippingReceiverLat !== undefined) {
        data.shippingReceiverLat =
            fields.shippingReceiverLat == null ? null : fields.shippingReceiverLat;
    }
    if (fields.shippingReceiverLng !== undefined) {
        data.shippingReceiverLng =
            fields.shippingReceiverLng == null ? null : fields.shippingReceiverLng;
    }
    if (fields.shippingPackageType !== undefined) {
        data.shippingPackageType = fields.shippingPackageType;
    }
    if (fields.shippingContents !== undefined)
        data.shippingContents = fields.shippingContents;
    if (fields.shippingDeliveryType !== undefined) {
        data.shippingDeliveryType = fields.shippingDeliveryType;
    }
    if (fields.shippingPickupType !== undefined) {
        data.shippingPickupType = fields.shippingPickupType;
    }
    if (fields.shippingPayer !== undefined)
        data.shippingPayer = fields.shippingPayer;
    if (fields.shippingWeightKg !== undefined) {
        data.shippingWeightKg =
            fields.shippingWeightKg == null ? null : fields.shippingWeightKg;
    }
    if (fields.shippingVolumeCbm !== undefined) {
        data.shippingVolumeCbm =
            fields.shippingVolumeCbm == null ? null : fields.shippingVolumeCbm;
    }
    if (fields.shippingPhoneCountry !== undefined) {
        data.shippingPhoneCountry =
            fields.shippingPhoneCountry == null || fields.shippingPhoneCountry === ''
                ? null
                : normalizeShippingPhoneCountry(fields.shippingPhoneCountry) ??
                    fields.shippingPhoneCountry.trim();
    }
    return data;
}
function copyShippingFieldsFromOms(oms) {
    return {
        shippingMethod: oms.shippingMethod ?? client_1.ShippingMethod.manual,
        shippingProviderCode: oms.shippingProviderCode ?? null,
        shippingReceiverLat: oms.shippingReceiverLat == null ? null : oms.shippingReceiverLat.toString(),
        shippingReceiverLng: oms.shippingReceiverLng == null ? null : oms.shippingReceiverLng.toString(),
        shippingPackageType: oms.shippingPackageType ?? null,
        shippingContents: oms.shippingContents ?? null,
        shippingDeliveryType: oms.shippingDeliveryType ?? null,
        shippingPickupType: oms.shippingPickupType ?? null,
        shippingPayer: oms.shippingPayer ?? null,
        shippingWeightKg: oms.shippingWeightKg == null ? null : oms.shippingWeightKg.toString(),
        shippingVolumeCbm: oms.shippingVolumeCbm == null ? null : oms.shippingVolumeCbm.toString(),
        shippingPhoneCountry: oms.shippingPhoneCountry ?? null,
    };
}
const SHIPPING_PATCH_KEYS = [
    'shippingMethod',
    'shippingProviderCode',
    'shippingReceiverLat',
    'shippingReceiverLng',
    'shippingPackageType',
    'shippingContents',
    'shippingDeliveryType',
    'shippingPickupType',
    'shippingPayer',
    'shippingWeightKg',
    'shippingVolumeCbm',
    'shippingPhoneCountry',
];
function hasShippingConfigPatch(fields) {
    return SHIPPING_PATCH_KEYS.some((k) => fields[k] !== undefined);
}
function sumLineWeightsKg(lines, weightByProductId) {
    let sum = 0;
    let any = false;
    for (const line of lines) {
        const w = weightByProductId.get(line.productId);
        if (w == null || w === '')
            continue;
        const weight = Number(w);
        const qty = Number(line.requestedQuantity);
        if (!Number.isFinite(weight) || !Number.isFinite(qty) || weight < 0 || qty <= 0) {
            continue;
        }
        any = true;
        sum += weight * qty;
    }
    return any ? Math.round(sum * 10000) / 10000 : null;
}
exports.calculateOrderWeight = sumLineWeightsKg;
function sumLineVolumesCbm(lines, volumeByProductId) {
    let sum = 0;
    let any = false;
    for (const line of lines) {
        const v = volumeByProductId.get(line.productId);
        if (v == null || v === '')
            continue;
        const volume = Number(v);
        const qty = Number(line.requestedQuantity);
        if (!Number.isFinite(volume) || !Number.isFinite(qty) || volume < 0 || qty <= 0) {
            continue;
        }
        any = true;
        sum += volume * qty;
    }
    return any ? Math.round(sum * 1_000_000) / 1_000_000 : null;
}
exports.calculateOrderVolume = sumLineVolumesCbm;
function resolveShippingWeightKg(params) {
    if (params.explicit !== undefined) {
        return params.explicit == null ? null : Number(params.explicit);
    }
    if ((params.method ?? client_1.ShippingMethod.manual) !== client_1.ShippingMethod.carrier) {
        return undefined;
    }
    return (0, exports.calculateOrderWeight)(params.lines, params.weightByProductId);
}
function resolveShippingVolumeCbm(params) {
    if (params.explicit !== undefined) {
        return params.explicit == null ? null : Number(params.explicit);
    }
    if ((params.method ?? client_1.ShippingMethod.manual) !== client_1.ShippingMethod.carrier) {
        return undefined;
    }
    return (0, exports.calculateOrderVolume)(params.lines, params.volumeByProductId);
}
//# sourceMappingURL=shipping-config.util.js.map