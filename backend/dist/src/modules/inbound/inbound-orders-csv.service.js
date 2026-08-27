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
exports.InboundOrdersCsvService = exports.INBOUND_IMPORT_MAX_ORDERS = exports.INBOUND_IMPORT_MAX_ROWS = exports.INBOUND_EXPORT_MAX_ROWS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const inbound_client_import_schema_1 = require("../client-portal/order-import/inbound-client-import.schema");
const admin_order_export_columns_1 = require("../oms/admin-order-export.columns");
const create_inbound_dto_1 = require("./dto/create-inbound.dto");
const inbound_orders_csv_util_1 = require("./inbound-orders-csv.util");
const inbound_service_1 = require("./inbound.service");
exports.INBOUND_EXPORT_MAX_ROWS = 10_000;
exports.INBOUND_IMPORT_MAX_ROWS = 2_000;
exports.INBOUND_IMPORT_MAX_ORDERS = 500;
let InboundOrdersCsvService = class InboundOrdersCsvService {
    inbound;
    constructor(inbound) {
        this.inbound = inbound;
    }
    columns() {
        return admin_order_export_columns_1.ADMIN_INBOUND_EXPORT_COLUMNS;
    }
    getImportTemplate() {
        return (0, inbound_client_import_schema_1.getInboundClientImportTemplate)();
    }
    getLegacyImportTemplate() {
        return {
            filename: 'inbound-orders-import-template.csv',
            body: (0, inbound_orders_csv_util_1.inboundImportTemplateCsv)(),
        };
    }
    async exportCsv(user, query, opts) {
        const columnIds = (0, admin_order_export_columns_1.adminOrderedColumnIds)(admin_order_export_columns_1.ADMIN_INBOUND_EXPORT_COLUMNS, opts?.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, total, truncated } = await this.inbound.listForExport(user, query, {
            maxRows: exports.INBOUND_EXPORT_MAX_ROWS,
            ids: opts?.ids,
        });
        const arabic = Boolean(opts?.arabicHeaders);
        const headers = (0, admin_order_export_columns_1.adminHeaderLabels)(admin_order_export_columns_1.ADMIN_INBOUND_EXPORT_COLUMNS, columnIds, arabic);
        const rows = items.map((o) => {
            const lineCount = o.lines?.length ?? 0;
            const totalQty = (o.lines ?? []).reduce((sum, l) => sum + Number(l.expectedQuantity ?? 0), 0);
            const cells = {
                order_number: o.orderNumber,
                status: o.status,
                company_id: o.companyId,
                company_name: o.company?.name ?? '',
                external_reference: o.externalReference ?? '',
                client_reference: o.clientReference ?? '',
                expected_arrival_date: o.expectedArrivalDate
                    ? new Date(o.expectedArrivalDate).toISOString().slice(0, 10)
                    : '',
                source_type: o.sourceType ?? '',
                store_channel: o.storeChannel ?? '',
                notes: o.notes ?? '',
                line_count: lineCount,
                total_expected_quantity: totalQty,
                execution_mode: o.executionMode ?? '',
                created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
                confirmed_at: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
                completed_at: o.completedAt ? new Date(o.completedAt).toISOString() : '',
            };
            return columnIds.map((id) => cells[id] ?? '');
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `inbound-orders-${stamp}.csv`,
            body: (0, inbound_orders_csv_util_1.rowsToCsv)(headers, rows),
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
                const created = await this.inbound.create(user, payload.dto);
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
        const table = (0, inbound_orders_csv_util_1.parseCsv)(text);
        if (table.length < 2) {
            throw new common_1.BadRequestException('CSV must include a header row and at least one data row.');
        }
        const { indexByHeader, unknown } = (0, inbound_orders_csv_util_1.mapCsvHeaderRow)(table[0]);
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown CSV column(s): ${unknown.slice(0, 8).join(', ')}. Download the template for the supported format.`);
        }
        const requiredHeaders = [
            'external_reference',
            'expected_arrival_date',
            'product_sku',
            'expected_quantity',
        ];
        for (const h of requiredHeaders) {
            if (indexByHeader[h] == null) {
                throw new common_1.BadRequestException(`Missing required CSV column: ${h}.`);
            }
        }
        const dataRows = table.slice(1);
        if (dataRows.length > exports.INBOUND_IMPORT_MAX_ROWS) {
            throw new common_1.BadRequestException(`CSV has ${dataRows.length} data rows; maximum is ${exports.INBOUND_IMPORT_MAX_ROWS}.`);
        }
        const groups = new Map();
        dataRows.forEach((cells, idx) => {
            const rowNumber = idx + 2;
            const externalReference = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'external_reference');
            const companyIdRaw = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'company_id');
            const sku = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'product_sku');
            const expectedQuantity = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'expected_quantity');
            const expectedLotNumber = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'expected_lot_number');
            const expectedExpiryDate = (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'expected_expiry_date');
            const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    externalReference,
                    companyIdRaw,
                    sourceRowNumbers: [],
                    headerRow: rowNumber,
                    fields: {
                        expected_arrival_date: (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'expected_arrival_date'),
                        client_reference: (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'client_reference'),
                        notes: (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'notes'),
                        source_type: (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'source_type'),
                        store_channel: (0, inbound_orders_csv_util_1.cell)(cells, indexByHeader, 'store_channel'),
                    },
                    lines: [],
                };
                groups.set(key, group);
            }
            group.sourceRowNumbers.push(rowNumber);
            group.lines.push({
                sku,
                expectedQuantity,
                expectedLotNumber,
                expectedExpiryDate,
                rowNumber,
            });
        });
        if (groups.size > exports.INBOUND_IMPORT_MAX_ORDERS) {
            throw new common_1.BadRequestException(`CSV has ${groups.size} orders; maximum is ${exports.INBOUND_IMPORT_MAX_ORDERS}.`);
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
                companyId = this.inbound.resolveImportCompanyId(user, g.companyIdRaw || undefined);
            }
            catch (err) {
                errors.push({
                    rowNumber: g.headerRow,
                    externalReference: ref,
                    reason: err instanceof Error ? err.message : 'Invalid company_id.',
                });
                continue;
            }
            const existing = await this.inbound.findByExternalReference(user, companyId, ref);
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
            const products = await this.inbound.findProductsBySkus(companyId, skus);
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
                const qty = Number(line.expectedQuantity);
                if (!Number.isFinite(qty) || qty <= 0) {
                    errors.push({
                        rowNumber: line.rowNumber,
                        externalReference: ref,
                        reason: `Invalid expected_quantity "${line.expectedQuantity}" for product "${sku}".`,
                    });
                    lineFailed = true;
                    continue;
                }
                lineDtos.push({
                    productId: product.id,
                    expectedQuantity: qty,
                    expectedLotNumber: line.expectedLotNumber.trim() || undefined,
                    expectedExpiryDate: line.expectedExpiryDate.trim() || undefined,
                });
            }
            if (lineFailed || lineDtos.length === 0)
                continue;
            const sourceRaw = g.fields.source_type.trim().toLowerCase();
            let sourceType;
            if (sourceRaw) {
                if (!Object.values(client_1.InboundSourceType).includes(sourceRaw)) {
                    errors.push({
                        rowNumber: g.headerRow,
                        externalReference: ref,
                        reason: `Invalid source_type "${g.fields.source_type}" (purchase|return|transfer).`,
                    });
                    continue;
                }
                sourceType = sourceRaw;
            }
            const plain = {
                companyId,
                expectedArrivalDate: g.fields.expected_arrival_date,
                clientReference: g.fields.client_reference || undefined,
                notes: g.fields.notes || undefined,
                sourceType,
                storeChannel: g.fields.store_channel || 'csv_import',
                externalReference: ref,
                executionMode: 'workers',
                lines: lineDtos,
            };
            const dto = (0, class_transformer_1.plainToInstance)(create_inbound_dto_1.CreateInboundOrderDto, plain);
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
                await this.inbound.assertImportCreateReady(user, dto);
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
exports.InboundOrdersCsvService = InboundOrdersCsvService;
exports.InboundOrdersCsvService = InboundOrdersCsvService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inbound_service_1.InboundService])
], InboundOrdersCsvService);
//# sourceMappingURL=inbound-orders-csv.service.js.map