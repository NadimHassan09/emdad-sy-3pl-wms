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
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const client_inbound_orders_service_1 = require("../inbound/client-inbound-orders.service");
const inbound_service_1 = require("../../inbound/inbound.service");
const inbound_client_import_schema_1 = require("./inbound-client-import.schema");
const order_import_grouping_1 = require("./order-import.grouping");
const spreadsheet_parse_1 = require("./spreadsheet.parse");
const SOURCE_TYPES = new Set(Object.values(client_1.InboundSourceType));
function parsePositiveQty(raw) {
    const n = Number(String(raw).trim().replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n;
}
let InboundClientImportService = class InboundClientImportService {
    clientInbound;
    inbound;
    constructor(clientInbound, inbound) {
        this.clientInbound = clientInbound;
        this.inbound = inbound;
    }
    getImportTemplate() {
        return (0, inbound_client_import_schema_1.getInboundClientImportTemplate)();
    }
    async importFile(client, fileBuffer, originalName) {
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
        const products = await this.inbound.findProductsBySkus(client.companyId, allSkus);
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
            const existing = await this.clientInbound.findByExternalReference(client, orderNumber);
            if (existing) {
                duplicate++;
                pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
                continue;
            }
            const arrival = (0, spreadsheet_parse_1.parseFlexibleDate)(group.fields.expected_arrival_date ?? '');
            if (!arrival) {
                invalid++;
                pushErr('Expected arrival date is required (YYYY-MM-DD).', 'expected_arrival_date');
                continue;
            }
            if (arrival < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
                invalid++;
                pushErr('Expected arrival date cannot be before today.', 'expected_arrival_date');
                continue;
            }
            const sourceRaw = (group.fields.source_type ?? '').trim();
            let sourceType;
            if (sourceRaw) {
                const lower = sourceRaw.toLowerCase();
                if (!SOURCE_TYPES.has(lower)) {
                    invalid++;
                    pushErr('Source type must be purchase, return, or transfer.', 'source_type');
                    continue;
                }
                sourceType = lower;
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
                const qty = parsePositiveQty(line.values.expected_quantity ?? '');
                if (qty == null) {
                    invalid++;
                    pushErr('Expected quantity must be greater than 0.', 'expected_quantity', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                const expiryRaw = line.values.expected_expiry_date?.trim() ?? '';
                const expiry = expiryRaw ? (0, spreadsheet_parse_1.parseFlexibleDate)(expiryRaw) : undefined;
                if (expiryRaw && !expiry) {
                    invalid++;
                    pushErr('Expected expiry date must be YYYY-MM-DD.', 'expected_expiry_date', line.rowNumber);
                    lineInvalid = true;
                    break;
                }
                lines.push({
                    productId: product.id,
                    expectedQuantity: qty,
                    expectedLotNumber: line.values.expected_lot_number?.trim() || undefined,
                    expectedExpiryDate: expiry || undefined,
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
                const createdOrder = await this.clientInbound.create(client, {
                    expectedArrivalDate: arrival,
                    notes: group.fields.notes || undefined,
                    sourceType,
                    externalReference: orderNumber,
                    clientReference: orderNumber,
                    lines,
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
exports.InboundClientImportService = InboundClientImportService;
exports.InboundClientImportService = InboundClientImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_inbound_orders_service_1.ClientInboundOrdersService,
        inbound_service_1.InboundService])
], InboundClientImportService);
//# sourceMappingURL=inbound-client-import.service.js.map