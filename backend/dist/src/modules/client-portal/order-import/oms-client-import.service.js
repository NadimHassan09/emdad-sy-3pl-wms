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
exports.OmsClientImportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const recipient_contact_1 = require("../../../common/validators/recipient-contact");
const oms_delivery_resolution_1 = require("../../oms/oms-delivery-resolution");
const oms_orders_service_1 = require("../../oms/oms-orders.service");
const shipping_geo_service_1 = require("../../shipping/shipping-geo.service");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const oms_client_import_schema_1 = require("./oms-client-import.schema");
const order_import_grouping_1 = require("./order-import.grouping");
const spreadsheet_parse_1 = require("./spreadsheet.parse");
const PAYMENT_METHODS = new Set(Object.values(client_1.OmsPaymentMethod));
function parsePositiveInt(raw) {
    const n = Number(String(raw).trim().replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n))
        return null;
    return n;
}
function parseNonNegativeNumber(raw) {
    const t = raw.trim();
    if (!t)
        return null;
    const n = Number(t.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0)
        return null;
    return n;
}
let OmsClientImportService = class OmsClientImportService {
    clientOms;
    omsOrders;
    geo;
    constructor(clientOms, omsOrders, geo) {
        this.clientOms = clientOms;
        this.omsOrders = omsOrders;
        this.geo = geo;
    }
    getImportTemplate() {
        return (0, oms_client_import_schema_1.getOmsClientImportTemplate)();
    }
    async importFile(client, fileBuffer, originalName) {
        const table = (0, spreadsheet_parse_1.parseSpreadsheetTable)(fileBuffer, originalName);
        const { dataRows } = (0, order_import_grouping_1.assertImportTable)(table, oms_client_import_schema_1.OMS_CLIENT_IMPORT_ALIASES, oms_client_import_schema_1.OMS_CLIENT_IMPORT_REQUIRED_COLUMNS);
        const groups = (0, order_import_grouping_1.groupRowsByOrderNumber)(dataRows, 'order_number', oms_client_import_schema_1.OMS_ORDER_LEVEL_FIELDS);
        const batchId = (0, crypto_1.randomUUID)();
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const errors = [];
        const createdOrderNumbers = [];
        const incompleteOrderNumbers = [];
        let created = 0;
        let incomplete = 0;
        let invalid = 0;
        let duplicate = 0;
        const allSkus = Array.from(new Set(dataRows
            .map((r) => r.values.sku?.trim().toUpperCase())
            .filter((s) => !!s)));
        const products = await this.omsOrders.findProductsBySkus(client.companyId, allSkus);
        const skuToProduct = new Map(products.map((p) => [p.sku.trim().toUpperCase(), p]));
        for (const group of groups) {
            const firstRow = group.rowNumbers[0] ?? 0;
            const orderNumber = group.orderNumber.trim();
            const pushErr = (error, field, rowNumber = firstRow) => {
                errors.push({
                    rowNumber,
                    orderNumber: orderNumber || null,
                    error,
                    field: field ?? null,
                });
            };
            if (!orderNumber || group.conflict?.field === 'order_number') {
                invalid++;
                pushErr('Order number is required.', 'order_number');
                continue;
            }
            if (group.conflict) {
                invalid++;
                pushErr(group.conflict.error, group.conflict.field);
                continue;
            }
            (0, oms_client_import_schema_1.applyAdminCityCompatibility)(group.fields);
            const existing = await this.clientOms.findByExternalReference(client, orderNumber);
            if (existing) {
                duplicate++;
                pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
                continue;
            }
            const lines = [];
            let lineInvalid = false;
            for (const line of group.lines) {
                const sku = line.values.sku?.trim() ?? '';
                if (!sku) {
                    invalid++;
                    pushErr('Product SKU is required.', 'sku', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const product = skuToProduct.get(sku.toUpperCase());
                if (!product) {
                    invalid++;
                    pushErr(`Unknown SKU "${sku}". Product was not created.`, 'sku', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const qty = parsePositiveInt(line.values.quantity ?? '');
                if (qty == null) {
                    invalid++;
                    pushErr('Quantity must be a whole number greater than 0.', 'quantity', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const unitPriceRaw = line.values.unit_price?.trim() ?? '';
                const unitPrice = unitPriceRaw ? parseNonNegativeNumber(unitPriceRaw) : undefined;
                if (unitPriceRaw && unitPrice == null) {
                    invalid++;
                    pushErr('Unit price must be a number greater than or equal to 0.', 'unit_price', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                lines.push({
                    productId: product.id,
                    requestedQuantity: qty,
                    unitPrice: unitPrice ?? undefined,
                    rowNumber: line.rowNumber,
                });
            }
            if (lineInvalid)
                continue;
            if (lines.length === 0) {
                invalid++;
                pushErr('Order must contain at least one product line.', 'sku');
                continue;
            }
            const shipDate = (0, spreadsheet_parse_1.parseFlexibleDate)(group.fields.required_ship_date ?? '');
            if (!shipDate) {
                invalid++;
                pushErr('Required ship date is required (YYYY-MM-DD).', 'required_ship_date');
                continue;
            }
            if (shipDate < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
                invalid++;
                pushErr('Required ship date cannot be before today.', 'required_ship_date');
                continue;
            }
            const paymentRaw = (group.fields.payment_method ?? '').trim();
            let paymentMethod;
            if (paymentRaw) {
                const upper = paymentRaw.toUpperCase();
                if (!PAYMENT_METHODS.has(upper)) {
                    invalid++;
                    pushErr('Payment method must be COD, PREPAID, or CREDIT.', 'payment_method');
                    continue;
                }
                paymentMethod = upper;
            }
            const contact = (0, recipient_contact_1.normalizeRecipientContact)({
                recipientName: group.fields.recipient_name || undefined,
                recipientPhone: group.fields.recipient_phone || undefined,
            });
            if (!contact.ok) {
                invalid++;
                pushErr(contact.message, contact.field);
                continue;
            }
            const delivery = await (0, oms_delivery_resolution_1.resolveOmsDeliveryLocation)(this.geo, {
                governorate: group.fields.governorate,
                city: group.fields.city,
                neighborhood: group.fields.neighborhood,
                street: group.fields.street,
            });
            const needsInformation = !delivery.complete;
            if (needsInformation) {
                for (const [field, message] of Object.entries(delivery.reasons)) {
                    pushErr(message, field);
                }
                if (Object.keys(delivery.reasons).length === 0) {
                    pushErr('Shipping/Delivery information is incomplete.', 'address');
                }
            }
            const payload = {
                companyId: client.companyId,
                requiredShipDate: shipDate,
                recipientName: contact.value.recipientName ?? group.fields.recipient_name,
                recipientPhone: contact.value.recipientPhone ?? group.fields.recipient_phone,
                shippingPhoneCountry: contact.value.shippingPhoneCountry ?? undefined,
                city: delivery.city ?? (group.fields.governorate || undefined),
                district: delivery.district ?? (group.fields.city || undefined),
                addressLine1: delivery.addressLine1 ?? (group.fields.neighborhood || undefined),
                addressLine2: delivery.addressLine2 ?? (group.fields.street || undefined),
                notes: group.fields.notes || undefined,
                storeChannel: group.fields.store_channel || undefined,
                paymentMethod,
                currency: group.fields.currency?.trim() || 'USD',
                externalReference: orderNumber,
                clientReference: orderNumber,
                shippingReceiverLat: delivery.lat ?? undefined,
                shippingReceiverLng: delivery.lng ?? undefined,
                lines: lines.map((l) => ({
                    productId: l.productId,
                    requestedQuantity: l.requestedQuantity,
                    unitPrice: l.unitPrice,
                    lineTotal: l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
                })),
            };
            try {
                const createdOrder = await this.omsOrders.create(user, payload, {
                    provisionOutbound: false,
                    bulkImport: { batchId, externalReference: orderNumber },
                    needsInformation,
                });
                if (needsInformation) {
                    incomplete++;
                    incompleteOrderNumbers.push(createdOrder.orderNumber);
                }
                else {
                    created++;
                    createdOrderNumbers.push(createdOrder.orderNumber);
                }
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    duplicate++;
                    pushErr('Duplicate order reference.', 'order_number');
                    continue;
                }
                invalid++;
                pushErr(err instanceof Error ? err.message : 'Create failed.');
            }
        }
        return {
            batchId,
            totalRows: dataRows.length,
            ordersDetected: groups.length,
            created,
            incomplete,
            invalid,
            duplicate,
            createdOrderNumbers,
            incompleteOrderNumbers,
            errors,
        };
    }
};
exports.OmsClientImportService = OmsClientImportService;
exports.OmsClientImportService = OmsClientImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_oms_orders_service_1.ClientOmsOrdersService,
        oms_orders_service_1.OmsOrdersService,
        shipping_geo_service_1.ShippingGeoService])
], OmsClientImportService);
//# sourceMappingURL=oms-client-import.service.js.map