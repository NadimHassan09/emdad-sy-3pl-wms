"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExternalApiDate = parseExternalApiDate;
exports.assertExternalApiDateNotBeforeToday = assertExternalApiDateNotBeforeToday;
exports.assertExternalOrderId = assertExternalOrderId;
exports.assertUniqueSkus = assertUniqueSkus;
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const oms_client_import_validation_1 = require("../order-import/oms-client-import.validation");
const api_validation_1 = require("./api-validation");
function parseExternalApiDate(raw, fieldName) {
    const t = raw.trim();
    const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
    if (iso) {
        const ymd = iso[1];
        const [y, m, d] = ymd.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() !== y ||
            dt.getUTCMonth() !== m - 1 ||
            dt.getUTCDate() !== d) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                [fieldName]: `${fieldName} is not a valid calendar date.`,
            });
        }
        return ymd;
    }
    const mdY = (0, oms_client_import_validation_1.parseImportMdYDate)(t, fieldName);
    if (!mdY.ok) {
        (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
            [fieldName]: mdY.message,
        });
    }
    return mdY.ymd;
}
function assertExternalApiDateNotBeforeToday(ymd, fieldName) {
    if (ymd < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
        (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
            [fieldName]: `${fieldName} cannot be before today.`,
        });
    }
}
function assertExternalOrderId(raw) {
    const result = (0, oms_client_import_validation_1.validateImportOrderNumber)(raw);
    if (!result.ok) {
        (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
            externalOrderId: result.message.replace(/^Order number/, 'externalOrderId'),
        });
    }
    return result.value;
}
function assertUniqueSkus(skus) {
    const seen = new Set();
    for (const sku of skus) {
        const key = sku.trim().toUpperCase();
        if (!key)
            continue;
        if (seen.has(key)) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                sku: `Duplicate SKU "${sku}" in the same order. Each product can only appear once.`,
            });
        }
        seen.add(key);
    }
}
//# sourceMappingURL=external-api-payload.util.js.map