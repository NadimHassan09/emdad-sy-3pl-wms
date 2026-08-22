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
    getImportTemplate() {
        return {
            filename: 'outbound-orders-import-template.csv',
            body: (0, outbound_orders_csv_util_1.outboundImportTemplateCsv)(),
        };
    }
    async exportCsv(user, query) {
        const { items, total, truncated } = await this.outbound.listForExport(user, query, {
            maxRows: exports.OUTBOUND_EXPORT_MAX_ROWS,
        });
        const headers = [
            'order_number',
            'status',
            'company_id',
            'company_name',
            'external_reference',
            'client_reference',
            'destination_address',
            'required_ship_date',
            'carrier',
            'tracking_number',
            'requires_packing',
            'notes',
            'line_count',
            'total_requested_quantity',
            'shipping_method',
            'execution_mode',
            'created_at',
            'confirmed_at',
            'shipped_at',
        ];
        const rows = items.map((o) => {
            const lineCount = o.lines?.length ?? 0;
            const totalQty = (o.lines ?? []).reduce((sum, l) => sum + Number(l.requestedQuantity ?? 0), 0);
            return [
                o.orderNumber,
                o.status,
                o.companyId,
                o.company?.name ?? '',
                o.externalReference ?? '',
                o.clientReference ?? '',
                o.destinationAddress ?? '',
                o.requiredShipDate ? new Date(o.requiredShipDate).toISOString().slice(0, 10) : '',
                o.carrier ?? '',
                o.trackingNumber ?? '',
                o.requiresPacking ? 'true' : 'false',
                o.notes ?? '',
                lineCount,
                totalQty,
                o.shippingMethod ?? '',
                o.executionMode ?? '',
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
                o.shippedAt ? new Date(o.shippedAt).toISOString() : '',
            ];
        });
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `outbound-orders-${stamp}.csv`,
            body: (0, outbound_orders_csv_util_1.rowsToCsv)(headers, rows),
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
                destinationAddress: g.fields.destination_address,
                requiredShipDate: g.fields.required_ship_date,
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