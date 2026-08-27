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
const oms_delivery_resolution_1 = require("../../oms/oms-delivery-resolution");
const oms_orders_service_1 = require("../../oms/oms-orders.service");
const shipping_geo_service_1 = require("../../shipping/shipping-geo.service");
const oms_client_import_schema_1 = require("./oms-client-import.schema");
const oms_client_import_validation_1 = require("./oms-client-import.validation");
const order_import_grouping_1 = require("./order-import.grouping");
const spreadsheet_parse_1 = require("./spreadsheet.parse");
let OmsClientImportService = class OmsClientImportService {
    omsOrders;
    geo;
    constructor(omsOrders, geo) {
        this.omsOrders = omsOrders;
        this.geo = geo;
    }
    getImportTemplate() {
        return (0, oms_client_import_schema_1.getOmsClientImportTemplate)();
    }
    async importFile(client, fileBuffer, originalName) {
        return this.importFileForCompany((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, fileBuffer, originalName);
    }
    async importFileForCompany(user, companyIdRaw, fileBuffer, originalName) {
        const companyId = this.omsOrders.resolveImportCompanyId(user, companyIdRaw);
        const table = (0, spreadsheet_parse_1.parseSpreadsheetTable)(fileBuffer, originalName);
        const { dataRows } = (0, order_import_grouping_1.assertImportTable)(table, oms_client_import_schema_1.OMS_CLIENT_IMPORT_ALIASES, oms_client_import_schema_1.OMS_CLIENT_IMPORT_REQUIRED_COLUMNS);
        const groups = (0, order_import_grouping_1.groupRowsByOrderNumber)(dataRows, 'order_number', oms_client_import_schema_1.OMS_ORDER_LEVEL_FIELDS);
        const batchId = (0, crypto_1.randomUUID)();
        const errors = [];
        const createdOrderNumbers = [];
        let created = 0;
        let invalid = 0;
        let duplicate = 0;
        const allSkus = Array.from(new Set(dataRows
            .map((r) => r.values.sku?.trim().toUpperCase())
            .filter((s) => !!s)));
        const products = await this.omsOrders.findProductsBySkus(companyId, allSkus);
        const skuToProduct = new Map(products.map((p) => [p.sku.trim().toUpperCase(), p]));
        for (const group of groups) {
            const firstRow = group.rowNumbers[0] ?? 0;
            const pushErr = (error, field, rowNumber = firstRow) => {
                errors.push({
                    rowNumber,
                    orderNumber: group.orderNumber.trim() || null,
                    error,
                    field: field ?? null,
                });
            };
            const orderNumberResult = (0, oms_client_import_validation_1.validateImportOrderNumber)(group.orderNumber);
            if (!orderNumberResult.ok) {
                invalid++;
                pushErr(orderNumberResult.message, 'order_number');
                continue;
            }
            const orderNumber = orderNumberResult.value;
            if (group.conflict) {
                invalid++;
                pushErr(group.conflict.error, group.conflict.field);
                continue;
            }
            (0, oms_client_import_schema_1.applyAdminCityCompatibility)(group.fields);
            const existing = await this.omsOrders.findExistingByExternalReference(user, companyId, orderNumber);
            if (existing) {
                duplicate++;
                pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
                continue;
            }
            const shipDateResult = (0, oms_client_import_validation_1.parseImportShipDateMdY)(group.fields.required_ship_date ?? '');
            if (!shipDateResult.ok) {
                invalid++;
                pushErr(shipDateResult.message, 'required_ship_date');
                continue;
            }
            if (shipDateResult.ymd < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
                invalid++;
                pushErr('Required ship date cannot be before today.', 'required_ship_date');
                continue;
            }
            const nameResult = (0, oms_client_import_validation_1.validateImportRecipientName)(group.fields.recipient_name ?? '');
            if (!nameResult.ok) {
                invalid++;
                pushErr(nameResult.message, 'recipient_name');
                continue;
            }
            const countryResult = (0, oms_client_import_validation_1.validateImportCountryCode)(group.fields.country_code ?? '');
            if (!countryResult.ok) {
                invalid++;
                pushErr(countryResult.message, 'country_code');
                continue;
            }
            const phoneResult = (0, oms_client_import_validation_1.validateImportRecipientPhone)(group.fields.recipient_phone ?? '', countryResult.iso);
            if (!phoneResult.ok) {
                invalid++;
                pushErr(phoneResult.message, 'recipient_phone');
                continue;
            }
            const paymentResult = (0, oms_client_import_validation_1.validateImportPaymentMethod)(group.fields.payment_method ?? '');
            if (!paymentResult.ok) {
                invalid++;
                pushErr(paymentResult.message, 'payment_method');
                continue;
            }
            if (!(group.fields.governorate ?? '').trim()) {
                invalid++;
                pushErr('Governorate is required.', 'governorate');
                continue;
            }
            if (!(group.fields.city ?? '').trim()) {
                invalid++;
                pushErr('City is required.', 'city');
                continue;
            }
            if (!(group.fields.neighborhood ?? '').trim()) {
                invalid++;
                pushErr('Neighborhood is required.', 'neighborhood');
                continue;
            }
            const delivery = await (0, oms_delivery_resolution_1.resolveOmsDeliveryLocation)(this.geo, {
                governorate: group.fields.governorate,
                city: group.fields.city,
                neighborhood: group.fields.neighborhood,
                street: group.fields.street,
            });
            if (!delivery.complete || !delivery.city || !delivery.district || !delivery.addressLine1) {
                invalid++;
                const reasonEntries = Object.entries(delivery.reasons);
                if (reasonEntries.length === 0) {
                    pushErr('Governorate, city, and neighborhood must match the system address list exactly (Arabic).', 'address');
                }
                else {
                    for (const [field, message] of reasonEntries) {
                        pushErr(message, field);
                    }
                }
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
                if (!product || product.sku.trim().toUpperCase() !== sku.toUpperCase()) {
                    invalid++;
                    pushErr(`Unknown SKU "${sku}". SKU must match a product registered for your company exactly.`, 'sku', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const qtyResult = (0, oms_client_import_validation_1.validateImportAsciiPositiveInt)(line.values.quantity ?? '', 'Quantity');
                if (!qtyResult.ok) {
                    invalid++;
                    pushErr(qtyResult.message, 'quantity', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const priceResult = (0, oms_client_import_validation_1.validateImportAsciiNonNegativeInt)(line.values.unit_price ?? '', 'Unit price');
                if (!priceResult.ok) {
                    invalid++;
                    pushErr(priceResult.message, 'unit_price', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                lines.push({
                    productId: product.id,
                    requestedQuantity: qtyResult.value,
                    unitPrice: priceResult.value,
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
            const payload = {
                companyId,
                requiredShipDate: shipDateResult.ymd,
                recipientName: nameResult.value,
                recipientPhone: phoneResult.e164,
                shippingPhoneCountry: phoneResult.shippingPhoneCountry,
                city: delivery.city,
                district: delivery.district,
                addressLine1: delivery.addressLine1,
                addressLine2: delivery.addressLine2 ?? (group.fields.street || undefined),
                notes: group.fields.notes || undefined,
                storeChannel: group.fields.store_channel || undefined,
                paymentMethod: paymentResult.value,
                currency: 'USD',
                externalReference: orderNumber,
                clientReference: orderNumber,
                shippingReceiverLat: delivery.lat ?? undefined,
                shippingReceiverLng: delivery.lng ?? undefined,
                lines: lines.map((l) => ({
                    productId: l.productId,
                    requestedQuantity: l.requestedQuantity,
                    unitPrice: l.unitPrice,
                    lineTotal: l.unitPrice * l.requestedQuantity,
                })),
            };
            try {
                const createdOrder = await this.omsOrders.create(user, payload, {
                    provisionOutbound: false,
                    needsInformation: false,
                });
                created++;
                createdOrderNumbers.push(createdOrder.orderNumber);
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
            incomplete: 0,
            invalid,
            duplicate,
            createdOrderNumbers,
            incompleteOrderNumbers: [],
            errors,
        };
    }
};
exports.OmsClientImportService = OmsClientImportService;
exports.OmsClientImportService = OmsClientImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oms_orders_service_1.OmsOrdersService,
        shipping_geo_service_1.ShippingGeoService])
], OmsClientImportService);
//# sourceMappingURL=oms-client-import.service.js.map