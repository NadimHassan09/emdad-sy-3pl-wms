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
exports.OmsOrdersCsvService = exports.OMS_IMPORT_MAX_ORDERS = exports.OMS_IMPORT_MAX_ROWS = exports.OMS_EXPORT_MAX_ROWS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const oms_client_import_schema_1 = require("../client-portal/order-import/oms-client-import.schema");
const admin_order_export_columns_1 = require("./admin-order-export.columns");
const oms_order_dto_1 = require("./dto/oms-order.dto");
const oms_orders_csv_util_1 = require("./oms-orders-csv.util");
const oms_orders_service_1 = require("./oms-orders.service");
exports.OMS_EXPORT_MAX_ROWS = 10_000;
exports.OMS_IMPORT_MAX_ROWS = 2_000;
exports.OMS_IMPORT_MAX_ORDERS = 500;
let OmsOrdersCsvService = class OmsOrdersCsvService {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    columns() {
        return admin_order_export_columns_1.ADMIN_OMS_EXPORT_COLUMNS;
    }
    getImportTemplate() {
        return (0, oms_client_import_schema_1.getOmsClientImportTemplate)();
    }
    getLegacyImportTemplate() {
        return {
            filename: 'oms-orders-import-template.csv',
            body: (0, oms_orders_csv_util_1.omsImportTemplateCsv)(),
        };
    }
    async exportCsv(user, query, opts) {
        const columnIds = (0, admin_order_export_columns_1.adminOrderedColumnIds)(admin_order_export_columns_1.ADMIN_OMS_EXPORT_COLUMNS, opts?.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, total, truncated } = await this.orders.listForExport(user, query, {
            maxRows: exports.OMS_EXPORT_MAX_ROWS,
            ids: opts?.ids,
        });
        const arabic = Boolean(opts?.arabicHeaders);
        const headers = (0, admin_order_export_columns_1.adminHeaderLabels)(admin_order_export_columns_1.ADMIN_OMS_EXPORT_COLUMNS, columnIds, arabic);
        const rows = items.map((o) => {
            const lineCount = o.lines?.length ?? 0;
            const totalQty = (o.lines ?? []).reduce((sum, l) => sum + Number(l.requestedQuantity ?? 0), 0);
            const cells = {
                order_number: o.orderNumber,
                status: o.status,
                company_id: o.companyId,
                company_name: o.company?.name ?? '',
                external_reference: o.externalReference ?? '',
                client_reference: o.clientReference ?? '',
                recipient_name: o.recipientName ?? '',
                recipient_phone: o.recipientPhone ?? '',
                city: o.city ?? '',
                district: o.district ?? '',
                address_line1: o.addressLine1 ?? '',
                store_channel: o.storeChannel ?? '',
                payment_method: o.paymentMethod ?? '',
                cod_status: o.codStatus ?? '',
                cod_amount: o.codAmount ?? '',
                currency: o.currency ?? '',
                subtotal: o.subtotal ?? '',
                shipping_fee: o.shippingFee ?? '',
                total: o.total ?? '',
                line_count: lineCount,
                total_quantity: totalQty,
                shipping_method: o.shippingMethod ?? '',
                shipping_provider_code: o.shippingProviderCode ?? '',
                carrier: o.carrier ?? '',
                outbound_order_number: o.linkedOutboundOrder?.orderNumber ?? '',
                required_ship_date: o.requiredShipDate
                    ? new Date(o.requiredShipDate).toISOString().slice(0, 10)
                    : '',
                created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
                confirmed_at: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
                approved_at: o.approvedAt ? new Date(o.approvedAt).toISOString() : '',
                out_for_delivery_at: o.outForDeliveryAt
                    ? new Date(o.outForDeliveryAt).toISOString()
                    : '',
                delivered_at: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : '',
            };
            return columnIds.map((id) => cells[id] ?? '');
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `oms-orders-${stamp}.csv`,
            body: (0, oms_orders_csv_util_1.rowsToCsv)(headers, rows),
            rowCount: items.length,
            truncated: truncated || total > items.length,
        };
    }
    async validateImport(user, fileBuffer) {
        const parsed = this.parseAndGroup(fileBuffer);
        return this.validateGroups(user, parsed.groups, parsed.totalRows);
    }
    async executeImport(user, fileBuffer) {
        const parsed = this.parseAndGroup(fileBuffer);
        const validated = await this.validateGroups(user, parsed.groups, parsed.totalRows);
        const batchId = validated.batchId;
        const createdOrderNumbers = [];
        const errors = [...validated.errors];
        let imported = 0;
        let failed = 0;
        const skippedDuplicates = validated.duplicateInDb + validated.duplicateInFile;
        for (const payload of validated._validPayloads ?? []) {
            try {
                const created = await this.orders.create(user, payload.dto, {
                    provisionOutbound: false,
                    bulkImport: { batchId, externalReference: payload.externalReference },
                });
                imported++;
                createdOrderNumbers.push(created.orderNumber);
            }
            catch (err) {
                failed++;
                const reason = err instanceof Error ? err.message : 'Create failed.';
                errors.push({
                    rowNumber: payload.sourceRowNumbers[0] ?? 0,
                    externalReference: payload.externalReference,
                    reason,
                });
            }
        }
        return {
            batchId,
            imported,
            failed: failed + validated.invalidOrders,
            skippedDuplicates,
            createdOrderNumbers,
            errors,
        };
    }
    parseAndGroup(fileBuffer) {
        if (fileBuffer.byteLength > 5 * 1024 * 1024) {
            throw new common_1.PayloadTooLargeException('CSV file must be 5 MB or smaller.');
        }
        const text = fileBuffer.toString('utf8');
        const table = (0, oms_orders_csv_util_1.parseCsv)(text);
        if (table.length < 2) {
            throw new common_1.BadRequestException('CSV must include a header row and at least one data row.');
        }
        const { indexByHeader, unknown } = (0, oms_orders_csv_util_1.mapCsvHeaderRow)(table[0]);
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown CSV column(s): ${unknown.slice(0, 8).join(', ')}. Download the template for the supported format.`);
        }
        const requiredHeaders = [
            'external_reference',
            'required_ship_date',
            'recipient_name',
            'recipient_phone',
            'city',
            'address_line1',
            'product_sku',
            'quantity',
        ];
        for (const h of requiredHeaders) {
            if (indexByHeader[h] == null) {
                throw new common_1.BadRequestException(`Missing required CSV column: ${h}.`);
            }
        }
        const dataRows = table.slice(1);
        if (dataRows.length > exports.OMS_IMPORT_MAX_ROWS) {
            throw new common_1.BadRequestException(`CSV has ${dataRows.length} data rows; maximum is ${exports.OMS_IMPORT_MAX_ROWS}.`);
        }
        const groups = new Map();
        dataRows.forEach((cells, idx) => {
            const rowNumber = idx + 2;
            const externalReference = (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'external_reference');
            const companyIdRaw = (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'company_id');
            const sku = (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'product_sku');
            const quantity = (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'quantity');
            const unitPrice = (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'unit_price');
            const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    externalReference,
                    companyIdRaw,
                    sourceRowNumbers: [],
                    headerRow: rowNumber,
                    fields: {
                        required_ship_date: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'required_ship_date'),
                        recipient_name: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'recipient_name'),
                        recipient_phone: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'recipient_phone'),
                        city: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'city'),
                        district: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'district'),
                        address_line1: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'address_line1'),
                        address_line2: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'address_line2'),
                        delivery_instructions: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'delivery_instructions'),
                        payment_method: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'payment_method'),
                        currency: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'currency'),
                        cod_amount: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'cod_amount'),
                        shipping_fee: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'shipping_fee'),
                        store_channel: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'store_channel'),
                        client_reference: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'client_reference'),
                        notes: (0, oms_orders_csv_util_1.cell)(cells, indexByHeader, 'notes'),
                    },
                    lines: [],
                };
                groups.set(key, group);
            }
            group.sourceRowNumbers.push(rowNumber);
            group.lines.push({ sku, quantity, unitPrice, rowNumber });
        });
        if (groups.size > exports.OMS_IMPORT_MAX_ORDERS) {
            throw new common_1.BadRequestException(`CSV has ${groups.size} orders; maximum is ${exports.OMS_IMPORT_MAX_ORDERS}.`);
        }
        return { totalRows: dataRows.length, groups: [...groups.values()] };
    }
    async validateGroups(user, groups, totalRows) {
        const batchId = (0, node_crypto_1.randomUUID)();
        const errors = [];
        let duplicateInFile = 0;
        let duplicateInDb = 0;
        const validPayloads = [];
        for (const g of groups) {
            const ref = g.externalReference.trim();
            if (!ref) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: null,
                    reason: 'external_reference is required.',
                });
                continue;
            }
            let companyId;
            try {
                companyId = this.orders.resolveImportCompanyId(user, g.companyIdRaw || undefined);
            }
            catch (err) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: err instanceof Error ? err.message : 'Invalid company_id.',
                });
                continue;
            }
            const existing = await this.orders.findExistingByExternalReference(user, companyId, ref);
            if (existing) {
                duplicateInDb++;
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: `Order with external_reference "${ref}" already exists (${existing.orderNumber}).`,
                });
                continue;
            }
            const skus = [...new Set(g.lines.map((l) => l.sku.trim().toUpperCase()).filter(Boolean))];
            if (skus.length === 0) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: 'At least one product_sku is required.',
                });
                continue;
            }
            const products = await this.orders.findProductsBySkus(companyId, skus);
            const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
            const lineDtos = [];
            let lineFailed = false;
            for (const line of g.lines) {
                const sku = line.sku.trim();
                if (!sku) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: 'product_sku is required.',
                    });
                    lineFailed = true;
                    continue;
                }
                const product = bySku.get(sku.toUpperCase());
                if (!product) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Product "${sku}" not found for this company.`,
                    });
                    lineFailed = true;
                    continue;
                }
                const qty = Number(line.quantity);
                if (!Number.isFinite(qty) || qty <= 0) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Invalid quantity "${line.quantity}" for product "${sku}".`,
                    });
                    lineFailed = true;
                    continue;
                }
                const unitPrice = line.unitPrice.trim() === '' ? undefined : Number(line.unitPrice);
                if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Invalid unit_price "${line.unitPrice}" for product "${sku}".`,
                    });
                    lineFailed = true;
                    continue;
                }
                lineDtos.push({
                    productId: product.id,
                    requestedQuantity: qty,
                    unitPrice,
                });
            }
            if (lineFailed || lineDtos.length === 0)
                continue;
            const paymentRaw = g.fields.payment_method.trim().toUpperCase();
            const paymentMethod = paymentRaw === ''
                ? undefined
                : paymentRaw;
            const plain = {
                companyId,
                requiredShipDate: g.fields.required_ship_date,
                recipientName: g.fields.recipient_name,
                recipientPhone: g.fields.recipient_phone,
                city: g.fields.city,
                district: g.fields.district || undefined,
                addressLine1: g.fields.address_line1,
                addressLine2: g.fields.address_line2 || undefined,
                deliveryInstructions: g.fields.delivery_instructions || undefined,
                paymentMethod,
                currency: g.fields.currency || 'USD',
                codAmount: g.fields.cod_amount.trim() === '' ? undefined : Number(g.fields.cod_amount),
                shippingFee: g.fields.shipping_fee.trim() === '' ? undefined : Number(g.fields.shipping_fee),
                storeChannel: g.fields.store_channel || 'csv_import',
                clientReference: g.fields.client_reference || undefined,
                notes: g.fields.notes || undefined,
                externalReference: ref,
                shippingMethod: client_1.ShippingMethod.manual,
                lines: lineDtos,
            };
            const dto = (0, class_transformer_1.plainToInstance)(oms_order_dto_1.CreateOmsOrderDto, plain);
            const dtoErrors = (0, class_validator_1.validateSync)(dto, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });
            if (dtoErrors.length > 0) {
                const msg = dtoErrors
                    .flatMap((e) => Object.values(e.constraints ?? {}))
                    .join('; ');
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: msg || 'Order failed validation.',
                });
                continue;
            }
            try {
                await this.orders.assertImportCreateReady(user, dto);
            }
            catch (err) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: err instanceof Error ? err.message : 'Order failed business validation.',
                });
                continue;
            }
            validPayloads.push({
                externalReference: ref,
                companyId,
                dto,
                sourceRowNumbers: g.sourceRowNumbers,
            });
        }
        return {
            batchId,
            totalRows,
            orderCount: groups.length,
            validOrders: validPayloads.length,
            invalidOrders: groups.length - validPayloads.length,
            duplicateInFile,
            duplicateInDb,
            errors,
            _validPayloads: validPayloads,
        };
    }
};
exports.OmsOrdersCsvService = OmsOrdersCsvService;
exports.OmsOrdersCsvService = OmsOrdersCsvService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oms_orders_service_1.OmsOrdersService])
], OmsOrdersCsvService);
//# sourceMappingURL=oms-orders-csv.service.js.map