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
exports.InboundClientImportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const inbound_service_1 = require("../../inbound/inbound.service");
const inbound_client_import_schema_1 = require("./inbound-client-import.schema");
const oms_client_import_validation_1 = require("./oms-client-import.validation");
const order_import_grouping_1 = require("./order-import.grouping");
const spreadsheet_parse_1 = require("./spreadsheet.parse");
let InboundClientImportService = class InboundClientImportService {
    inbound;
    constructor(inbound) {
        this.inbound = inbound;
    }
    getImportTemplate() {
        return (0, inbound_client_import_schema_1.getInboundClientImportTemplate)();
    }
    async importFile(client, fileBuffer, originalName) {
        return this.importFileForCompany((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, fileBuffer, originalName);
    }
    async importFileForCompany(user, companyIdRaw, fileBuffer, originalName) {
        const companyId = this.inbound.resolveImportCompanyId(user, companyIdRaw);
        const table = (0, spreadsheet_parse_1.parseSpreadsheetTable)(fileBuffer, originalName);
        const { dataRows } = (0, order_import_grouping_1.assertImportTable)(table, inbound_client_import_schema_1.INBOUND_CLIENT_IMPORT_ALIASES, inbound_client_import_schema_1.INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS);
        const groups = (0, order_import_grouping_1.groupRowsByOrderNumber)(dataRows, 'order_number', inbound_client_import_schema_1.INBOUND_ORDER_LEVEL_FIELDS);
        const batchId = (0, crypto_1.randomUUID)();
        const errors = [];
        const createdOrderNumbers = [];
        let created = 0;
        let invalid = 0;
        let duplicate = 0;
        const allSkus = Array.from(new Set(dataRows
            .map((r) => r.values.sku?.trim().toUpperCase())
            .filter((s) => !!s)));
        const products = await this.inbound.findProductsBySkus(companyId, allSkus);
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
            const existing = await this.inbound.findByExternalReference(user, companyId, orderNumber);
            if (existing) {
                duplicate++;
                pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
                continue;
            }
            const arrivalResult = (0, oms_client_import_validation_1.parseImportMdYDate)(group.fields.expected_arrival_date ?? '', 'Expected arrival date');
            if (!arrivalResult.ok) {
                invalid++;
                pushErr(arrivalResult.message, 'expected_arrival_date');
                continue;
            }
            if (arrivalResult.ymd < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
                invalid++;
                pushErr('Expected arrival date cannot be before today.', 'expected_arrival_date');
                continue;
            }
            const lines = [];
            const seenProductIds = new Set();
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
                    pushErr(`Unknown SKU "${sku}". SKU must match a product registered for your company exactly.`, 'sku', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                if (seenProductIds.has(product.id)) {
                    invalid++;
                    pushErr(`Duplicate SKU "${sku}" in the same order. Each product can only appear once.`, 'sku', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                seenProductIds.add(product.id);
                const qtyResult = (0, oms_client_import_validation_1.validateImportAsciiPositiveInt)(line.values.quantity ?? '', 'Quantity');
                if (!qtyResult.ok) {
                    invalid++;
                    pushErr(qtyResult.message, 'quantity', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                lines.push({
                    productId: product.id,
                    expectedQuantity: qtyResult.value,
                });
            }
            if (lineInvalid)
                continue;
            if (lines.length === 0) {
                invalid++;
                pushErr('Order must contain at least one product line.', 'sku');
                continue;
            }
            try {
                const createdOrder = await this.inbound.create(user, {
                    companyId,
                    expectedArrivalDate: arrivalResult.ymd,
                    notes: group.fields.notes?.trim() || undefined,
                    externalReference: orderNumber,
                    clientReference: orderNumber,
                    lines,
                    executionMode: 'admin',
                    executionPlan: undefined,
                }, { pendingClientApproval: true });
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
exports.InboundClientImportService = InboundClientImportService;
exports.InboundClientImportService = InboundClientImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inbound_service_1.InboundService])
], InboundClientImportService);
//# sourceMappingURL=inbound-client-import.service.js.map