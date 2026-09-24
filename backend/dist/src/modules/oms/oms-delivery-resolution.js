"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOmsDeliveryLocation = resolveOmsDeliveryLocation;
const geo_polygon_util_1 = require("../shipping/geo-polygon.util");
const address_resolve_service_1 = require("../shipping/address-resolve.service");
const syria_address_1 = require("../client-portal/external-api/syria-address");
const internalResolver = new address_resolve_service_1.AddressResolveService();
async function resolveOmsDeliveryLocation(geo, input) {
    const address = (0, syria_address_1.resolveSyriaAddress)({
        governorate: input.governorate ?? undefined,
        city: input.city ?? undefined,
        neighborhood: input.neighborhood ?? undefined,
        street: input.street ?? undefined,
    });
    if (!address.ok) {
        return {
            complete: false,
            reasons: address.fields,
            city: input.governorate?.trim() || null,
            district: input.city?.trim() || null,
            addressLine1: input.neighborhood?.trim() || null,
            addressLine2: input.street?.trim() || null,
            lat: null,
            lng: null,
        };
    }
    const boundary = await geo.lookupBoundary({
        governorate: address.value.governorate,
        city: address.value.city,
        neighborhood: address.value.neighborhood,
    });
    if (boundary) {
        let point = (0, geo_polygon_util_1.bboxCentroid)(boundary.bbox);
        if (!geo.containsPoint(boundary, point)) {
            point = {
                lat: boundary.bbox.south + (boundary.bbox.north - boundary.bbox.south) * 0.35,
                lng: boundary.bbox.west + (boundary.bbox.east - boundary.bbox.west) * 0.5,
            };
        }
        if (geo.containsPoint(boundary, point)) {
            return {
                complete: true,
                reasons: {},
                city: address.value.governorate,
                district: address.value.city,
                addressLine1: address.value.neighborhood,
                addressLine2: address.value.street,
                lat: point.lat,
                lng: point.lng,
            };
        }
    }
    const internal = internalResolver.resolveFromAddress({
        governorate: address.value.governorate,
        cityRegion: address.value.city,
        townNeighborhood: address.value.neighborhood,
    });
    if (internal.found) {
        return {
            complete: true,
            reasons: {},
            city: address.value.governorate,
            district: address.value.city,
            addressLine1: address.value.neighborhood,
            addressLine2: address.value.street,
            lat: internal.lat,
            lng: internal.lng,
        };
    }
    return {
        complete: false,
        reasons: {
            address: 'Could not geocode this governorate/city. Shipping/Delivery information is incomplete.',
        },
        city: address.value.governorate,
        district: address.value.city,
        addressLine1: address.value.neighborhood,
        addressLine2: address.value.street,
        lat: null,
        lng: null,
    };
}
//# sourceMappingURL=oms-delivery-resolution.js.map