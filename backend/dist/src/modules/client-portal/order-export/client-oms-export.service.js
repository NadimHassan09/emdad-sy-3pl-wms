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
        case 'currency':
            return String(order.currency ?? '');
        case 'payment_method':
            return String(order.paymentMethod ?? '');
        case 'carrier':
            return String(order.carrier ?? '');
        case 'tracking_number':
            return String(order.trackingNumber ?? '');
        case 'warehouse_status':
            return String(order.warehouseStatus ?? '');
        case 'incomplete':
            return order.needsInformation ? 'yes' : 'no';
        case 'created_at':
            return order.createdAt ? new Date(String(order.createdAt)).toISOString() : '';
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
    async exportCsv(client, dto) {
        const columnIds = (0, client_order_export_columns_1.orderedColumnIds)(client_order_export_columns_1.CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
        if (columnIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one valid export column.');
        }
        const { items, truncated } = await this.oms.listForExport(client, {
            orderSearch: dto.orderSearch,
            status: dto.status,
            storeChannel: dto.storeChannel,
            createdFrom: dto.createdFrom,
            createdTo: dto.createdTo,
        }, { maxRows: MAX_ROWS, ids: dto.ids });
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
};
exports.ClientOmsExportService = ClientOmsExportService;
exports.ClientOmsExportService = ClientOmsExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_oms_orders_service_1.ClientOmsOrdersService])
], ClientOmsExportService);
//# sourceMappingURL=client-oms-export.service.js.map