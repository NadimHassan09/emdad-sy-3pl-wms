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
exports.OutboundOrdersCsvService = exports.OUTBOUND_IMPORT_MAX_ORDERS = exports.OUTBOUND_IMPORT_MAX_ROWS = exports.OUTBOUND_EXPORT_MAX_ROWS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const excel_export_util_1 = require("../../common/utils/excel-export.util");
const oms_client_import_validation_1 = require("../client-portal/order-import/oms-client-import.validation");
const outbound_client_import_schema_1 = require("../client-portal/order-import/outbound-client-import.schema");
const admin_order_export_columns_1 = require("../oms/admin-order-export.columns");
const order_export_product_cells_1 = require("../oms/order-export-product-cells");
const create_outbound_dto_1 = require("./dto/create-outbound.dto");
const outbound_orders_csv_util_1 = require("./outbound-orders-csv.util");
const outbound_service_1 = require("./outbound.service");
exports.OUTBOUND_EXPORT_MAX_ROWS = 10_000;
exports.OUTBOUND_IMPORT_MAX_ROWS = 2_000;
exports.OUTBOUND_IMPORT_MAX_ORDERS = 500;
let OutboundOrdersCsvService = class OutboundOrdersCsvService {
    outbound;
    constructor(outbound) {
        this.outbound = outbound;
    }
    columns() {
        return admin_order_export_columns_1.ADMIN_OUTBOUND_EXPORT_COLUMNS;
    }
    getImportTemplate() {
        return (0, outbound_client_import_schema_1.getOutboundClientImportTemplate)();
    }
    getLegacyImportTemplate() {
        return {
            filename: 'outbound-orders-import-template.csv',
            body: (0, outbound_orders_csv_util_1.outboundImportTemplateCsv)(),
        };
    }
    async exportCsv(user, query, opts) {
        const columnIds = (0, admin_order_export_columns_1.adminOrderedColumnIds)(admin_order_export_columns_1.ADMIN_OUTBOUND_EXPORT_COLUMNS, opts?.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, total, truncated } = await this.outbound.listForExport(user, query, {
            maxRows: exports.OUTBOUND_EXPORT_MAX_ROWS,
            ids: opts?.ids,
        });
        const arabic = Boolean(opts?.arabicHeaders);
        const headers = (0, admin_order_export_columns_1.adminHeaderLabels)(admin_order_export_columns_1.ADMIN_OUTBOUND_EXPORT_COLUMNS, columnIds, arabic);
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
                destination_address: o.destinationAddress ?? '',
                required_ship_date: o.requiredShipDate
                    ? new Date(o.requiredShipDate).toISOString().slice(0, 10)
                    : '',
                carrier: o.carrier ?? '',
                tracking_number: o.trackingNumber ?? '',
                requires_packing: o.requiresPacking ? 'true' : 'false',
                notes: o.notes ?? '',
                line_count: lineCount,
                total_requested_quantity: totalQty,
                product_name: (0, order_export_product_cells_1.exportProductNames)(o.lines),
                product_weight: (0, order_export_product_cells_1.exportProductWeights)(o.lines),
                shipping_method: o.shippingMethod ?? '',
                execution_mode: o.executionMode ?? '',
                created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
                confirmed_at: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
                shipped_at: o.shippedAt ? new Date(o.shippedAt).toISOString() : '',
            };
            return columnIds.map((id) => cells[id] ?? '');
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `outbound-orders-${stamp}.csv`,
            body: (0, outbound_orders_csv_util_1.rowsToCsv)(headers, rows),
            rowCount: items.length,
            truncated: truncated || total > items.length,
        };
    }
    async exportXlsx(user, query, opts) {
        const columnIds = (0, admin_order_export_columns_1.adminOrderedColumnIds)(admin_order_export_columns_1.ADMIN_OUTBOUND_EXPORT_COLUMNS, opts?.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, total, truncated } = await this.outbound.listForExport(user, query, {
            maxRows: exports.OUTBOUND_EXPORT_MAX_ROWS,
            ids: opts?.ids,
        });
        const arabic = Boolean(opts?.arabicHeaders);
        const headers = (0, admin_order_export_columns_1.adminHeaderLabels)(admin_order_export_columns_1.ADMIN_OUTBOUND_EXPORT_COLUMNS, columnIds, arabic);
        const columns = columnIds.map((id, idx) => ({
            header: headers[idx] ?? id,
            key: id,
        }));
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
                destination_address: o.destinationAddress ?? '',
                required_ship_date: o.requiredShipDate
                    ? new Date(o.requiredShipDate).toISOString().slice(0, 10)
                    : '',
                carrier: o.carrier ?? '',
                tracking_number: o.trackingNumber ?? '',
                requires_packing: o.requiresPacking ? 'true' : 'false',
                notes: o.notes ?? '',
                line_count: lineCount,
                total_requested_quantity: totalQty,
                product_name: (0, order_export_product_cells_1.exportProductNames)(o.lines),
                product_weight: (0, order_export_product_cells_1.exportProductWeights)(o.lines),
                shipping_method: o.shippingMethod ?? '',
                execution_mode: o.executionMode ?? '',
                created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
                confirmed_at: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
                shipped_at: o.shippedAt ? new Date(o.shippedAt).toISOString() : '',
            };
            const rowObj = {};
            for (const id of columnIds) {
                rowObj[id] = cells[id] ?? '';
            }
            return rowObj;
        });
        const statusCounts = items.reduce((acc, o) => {
            const s = String(o.status ?? '—');
            acc[s] = (acc[s] ?? 0) + 1;
            return acc;
        }, {});
        const statusSummary = Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${s}: ${n}`)
            .join('  |  ');
        const totalQtyAll = items.reduce((sum, o) => sum + (o.lines ?? []).reduce((s, l) => s + Number(l.requestedQuantity ?? 0), 0), 0);
        const buffer = await (0, excel_export_util_1.buildExcelBuffer)({
            sheetName: 'Outbound Orders',
            title: 'Outbound Orders Export',
            columns,
            rows,
            summary: [
                { label: 'Total Orders', value: items.length },
                { label: 'By Status', value: statusSummary || '—' },
                { label: 'Total Requested Qty', value: totalQtyAll },
                { label: 'Export Date', value: new Date().toISOString().slice(0, 10) },
            ],
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `outbound-orders-${stamp}.xlsx`,
            buffer,
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
                const created = await this.outbound.create(user, payload.dto, {
                    skipAllocation: true,
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
        const table = (0, outbound_orders_csv_util_1.parseCsv)(text);
        if (table.length < 2) {
            throw new common_1.BadRequestException('CSV must include a header row and at least one data row.');
        }
        const { indexByHeader, unknown } = (0, outbound_orders_csv_util_1.mapCsvHeaderRow)(table[0]);
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown CSV column(s): ${unknown.slice(0, 8).join(', ')}. Download the template for the supported format.`);
        }
        const requiredHeaders = [
            'external_reference',
            'destination_address',
            'required_ship_date',
            'product_sku',
            'requested_quantity',
        ];
        for (const h of requiredHeaders) {
            if (indexByHeader[h] == null) {
                throw new common_1.BadRequestException(`Missing required CSV column: ${h}.`);
            }
        }
        const dataRows = table.slice(1);
        if (dataRows.length > exports.OUTBOUND_IMPORT_MAX_ROWS) {
            throw new common_1.BadRequestException(`CSV has ${dataRows.length} data rows; maximum is ${exports.OUTBOUND_IMPORT_MAX_ROWS}.`);
        }
        const groups = new Map();
        dataRows.forEach((cells, idx) => {
            const rowNumber = idx + 2;
            const externalReference = (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'external_reference');
            const companyIdRaw = (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'company_id');
            const sku = (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'product_sku');
            const requestedQuantity = (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'requested_quantity');
            const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    externalReference,
                    companyIdRaw,
                    sourceRowNumbers: [],
                    headerRow: rowNumber,
                    fields: {
                        destination_address: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'destination_address'),
                        required_ship_date: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'required_ship_date'),
                        carrier: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'carrier'),
                        client_reference: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'client_reference'),
                        notes: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'notes'),
                        requires_packing: (0, outbound_orders_csv_util_1.cell)(cells, indexByHeader, 'requires_packing'),
                    },
                    lines: [],
                };
                groups.set(key, group);
            }
            group.sourceRowNumbers.push(rowNumber);
            group.lines.push({ sku, requestedQuantity, rowNumber });
        });
        if (groups.size > exports.OUTBOUND_IMPORT_MAX_ORDERS) {
            throw new common_1.BadRequestException(`CSV has ${groups.size} orders; maximum is ${exports.OUTBOUND_IMPORT_MAX_ORDERS}.`);
        }
        return { totalRows: dataRows.length, groups: [...groups.values()] };
    }
    async validateGroups(user, groups, totalRows) {
        const batchId = (0, node_crypto_1.randomUUID)();
        const errors = [];
        const duplicateInFile = 0;
        let duplicateInDb = 0;
        const validPayloads = [];
        for (const g of groups) {
            const ref = g.externalReference.trim();
            const refResult = (0, oms_client_import_validation_1.validateImportOrderNumber)(ref);
            if (!refResult.ok) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref || null,
                    reason: refResult.message,
                });
                continue;
            }
            const dateResult = (0, oms_client_import_validation_1.parseImportShipDateMdY)(g.fields.required_ship_date || '');
            if (!dateResult.ok) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: dateResult.message,
                });
                continue;
            }
            let companyId;
            try {
                companyId = this.outbound.resolveImportCompanyId(user, g.companyIdRaw || undefined);
            }
            catch (err) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: err instanceof Error ? err.message : 'Invalid company_id.',
                });
                continue;
            }
            const existing = await this.outbound.findByExternalReference(user, companyId, ref);
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
            const products = await this.outbound.findProductsBySkus(companyId, skus);
            const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
            const lineDtos = [];
            const seenProductIds = new Set();
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
                if (seenProductIds.has(product.id)) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Duplicate product line: SKU "${sku}" appears more than once in the order. Each product can only appear once.`,
                    });
                    lineFailed = true;
                    continue;
                }
                seenProductIds.add(product.id);
                const qty = Number(line.requestedQuantity);
                if (!Number.isFinite(qty) || qty <= 0) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Invalid requested_quantity "${line.requestedQuantity}" for product "${sku}".`,
                    });
                    lineFailed = true;
                    continue;
                }
                try {
                    (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(product.uom, qty, 'Requested quantity');
                }
                catch (err) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: err instanceof Error
                            ? err.message
                            : `Invalid requested_quantity for UOM "${product.uom}".`,
                    });
                    lineFailed = true;
                    continue;
                }
                lineDtos.push({
                    productId: product.id,
                    requestedQuantity: qty,
                });
            }
            if (lineFailed || lineDtos.length === 0)
                continue;
            let requiresPacking;
            try {
                requiresPacking = (0, outbound_orders_csv_util_1.parseRequiresPacking)(g.fields.requires_packing);
            }
            catch (err) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: err instanceof Error ? err.message : 'Invalid requires_packing.',
                });
                continue;
            }
            const plain = {
                companyId,
                destinationAddress: (g.fields.destination_address ?? '').trim(),
                requiredShipDate: dateResult.ymd,
                carrier: g.fields.carrier || undefined,
                clientReference: g.fields.client_reference || undefined,
                notes: g.fields.notes || undefined,
                requiresPacking,
                externalReference: ref,
                executionMode: 'workers',
                shippingMethod: client_1.ShippingMethod.manual,
                lines: lineDtos,
            };
            const dto = (0, class_transformer_1.plainToInstance)(create_outbound_dto_1.CreateOutboundOrderDto, plain);
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
                await this.outbound.assertImportCreateReady(user, dto);
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
exports.OutboundOrdersCsvService = OutboundOrdersCsvService;
exports.OutboundOrdersCsvService = OutboundOrdersCsvService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [outbound_service_1.OutboundService])
], OutboundOrdersCsvService);
//# sourceMappingURL=outbound-orders-csv.service.js.map