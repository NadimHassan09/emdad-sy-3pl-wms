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
exports.ClientOmsExportService = void 0;
const common_1 = require("@nestjs/common");
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const order_export_product_cells_1 = require("../../oms/order-export-product-cells");
const excel_export_util_1 = require("../../../common/utils/excel-export.util");
const client_order_export_columns_1 = require("./client-order-export.columns");
const MAX_ROWS = 10_000;
function cell(order, id) {
    switch (id) {
        case 'order_number':
            return String(order.orderNumber ?? '');
        case 'status':
            return String(order.status ?? '');
        case 'external_order_id':
            return String(order.externalReference ?? order.clientReference ?? '');
        case 'recipient_name':
            return String(order.recipientName ?? '');
        case 'recipient_phone':
            return String(order.recipientPhone ?? '');
        case 'city':
            return String(order.city ?? '');
        case 'district':
            return String(order.district ?? '');
        case 'address':
            return String(order.addressLine1 ?? order.destinationAddress ?? '');
        case 'required_ship_date':
            return order.requiredShipDate
                ? new Date(String(order.requiredShipDate)).toISOString().slice(0, 10)
                : '';
        case 'total':
            return order.total != null ? String(order.total) : '';
        case 'product_name':
            return (0, order_export_product_cells_1.exportProductNames)(order.lines);
        case 'product_weight':
            return (0, order_export_product_cells_1.exportProductWeights)(order.lines);
        case 'currency':
            return String(order.currency ?? '');
        case 'payment_method':
            return String(order.paymentMethod ?? '');
        case 'carrier':
            return '';
        case 'tracking_number':
            return String(order.trackingNumber ?? '');
        case 'warehouse_status':
            return String(order.warehouseStatus ?? '');
        case 'incomplete':
            return order.needsInformation ? 'yes' : 'no';
        case 'created_at':
            return order.createdAt ? new Date(String(order.createdAt)).toISOString() : '';
        case 'out_for_delivery_at':
            return order.outForDeliveryAt
                ? new Date(String(order.outForDeliveryAt)).toISOString()
                : '';
        case 'delivered_at':
            return order.deliveredAt
                ? new Date(String(order.deliveredAt)).toISOString().slice(0, 10)
                : '';
        case 'notes':
            return String(order.notes ?? '');
        default:
            return '';
    }
}
let ClientOmsExportService = class ClientOmsExportService {
    oms;
    constructor(oms) {
        this.oms = oms;
    }
    columns() {
        return client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS;
    }
    buildExportQuery(dto) {
        return {
            orderSearch: dto.orderSearch,
            status: dto.status,
            storeChannel: dto.storeChannel,
            customer: dto.customer,
            phone: dto.phone,
            city: dto.city,
            carrier: dto.carrier,
            startOrderNo: dto.startOrderNo,
            endOrderNo: dto.endOrderNo,
            totalOp: dto.totalOp,
            totalValue: dto.totalValue,
            operationalStage: dto.operationalStage,
            createdFrom: dto.createdFrom,
            createdTo: dto.createdTo,
        };
    }
    async exportCsv(client, dto) {
        const columnIds = (0, client_order_export_columns_1.orderedColumnIds)(client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, truncated } = await this.oms.listForExport(client, this.buildExportQuery(dto), { maxRows: MAX_ROWS, ids: dto.ids });
        const arabic = Boolean(dto.arabicHeaders);
        const headers = (0, client_order_export_columns_1.headerLabels)(client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS, columnIds, arabic);
        const rows = items.map((order) => columnIds.map((id) => cell(order, id)));
        const stamp = new Date().toISOString().slice(0, 10);
        return {
            filename: `oms-orders-${stamp}.csv`,
            body: (0, oms_orders_csv_util_1.rowsToCsv)(headers, rows),
            rowCount: items.length,
            truncated,
        };
    }
    async exportXlsx(client, dto) {
        const columnIds = (0, client_order_export_columns_1.orderedColumnIds)(client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, truncated } = await this.oms.listForExport(client, this.buildExportQuery(dto), { maxRows: MAX_ROWS, ids: dto.ids });
        const arabic = Boolean(dto.arabicHeaders);
        const headers = (0, client_order_export_columns_1.headerLabels)(client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS, columnIds, arabic);
        const rows = items.map((order) => {
            const record = {};
            for (const id of columnIds) {
                record[id] = cell(order, id);
            }
            return record;
        });
        const stamp = new Date().toISOString().slice(0, 10);
        const statusCounts = items.reduce((acc, o) => {
            const s = String(o.status ?? '—');
            acc[s] = (acc[s] ?? 0) + 1;
            return acc;
        }, {});
        const statusSummary = Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${s}: ${n}`)
            .join('  |  ');
        const buffer = await (0, excel_export_util_1.buildExcelBuffer)({
            sheetName: 'Online Orders',
            title: 'Online Orders Export',
            columns: columnIds.map((id, idx) => ({ header: headers[idx] ?? id, key: id })),
            rows,
            isRtl: arabic,
            summary: [
                { label: 'Total Orders', value: items.length },
                { label: 'By Status', value: statusSummary || '—' },
                { label: 'Export Date', value: stamp },
            ],
        });
        return {
            filename: `oms-orders-${stamp}.xlsx`,
            buffer,
            rowCount: items.length,
            truncated,
        };
    }
};
exports.ClientOmsExportService = ClientOmsExportService;
exports.ClientOmsExportService = ClientOmsExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_oms_orders_service_1.ClientOmsOrdersService])
], ClientOmsExportService);
//# sourceMappingURL=client-oms-export.service.js.map