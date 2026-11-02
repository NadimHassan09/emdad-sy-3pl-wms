import { BadRequestException, Injectable } from '@nestjs/common';
import { OmsOrderStatus } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ClientOmsOrdersExportDto } from '../oms/dto/bulk-confirm-client-oms-orders.dto';
import { exportProductNames, exportProductWeights } from '../../oms/order-export-product-cells';
import { buildExcelBuffer } from '../../../common/utils/excel-export.util';
import {
  CLIENT_OMS_EXPORT_COLUMNS,
  headerLabels,
  orderedColumnIds,
} from './client-order-export.columns';

const MAX_ROWS = 10_000;

function cell(order: Record<string, unknown>, id: string): string {
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
      return exportProductNames(order.lines);
    case 'product_weight':
      return exportProductWeights(order.lines);
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

@Injectable()
export class ClientOmsExportService {
  constructor(private readonly oms: ClientOmsOrdersService) {}

  columns() {
    return CLIENT_OMS_EXPORT_COLUMNS;
  }

  private buildExportQuery(dto: ClientOmsOrdersExportDto) {
    return {
      orderSearch: dto.orderSearch,
      status: dto.status as OmsOrderStatus | undefined,
      storeChannel: dto.storeChannel,
      customer: dto.customer,
      phone: dto.phone,
      city: dto.city,
      carrier: dto.carrier,
      startOrderNo: dto.startOrderNo,
      endOrderNo: dto.endOrderNo,
      totalOp: dto.totalOp as any,
      totalValue: dto.totalValue,
      operationalStage: dto.operationalStage as any,
      createdFrom: dto.createdFrom,
      createdTo: dto.createdTo,
    };
  }

  async exportCsv(client: ClientPrincipal, dto: ClientOmsOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.oms.listForExport(
      client,
      this.buildExportQuery(dto),
      { maxRows: MAX_ROWS, ids: dto.ids },
    );

    const arabic = Boolean(dto.arabicHeaders);
    const headers = headerLabels(CLIENT_OMS_EXPORT_COLUMNS, columnIds, arabic);
    const rows = items.map((order) =>
      columnIds.map((id) => cell(order as unknown as Record<string, unknown>, id)),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `oms-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated,
    };
  }

  async exportXlsx(client: ClientPrincipal, dto: ClientOmsOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.oms.listForExport(
      client,
      this.buildExportQuery(dto),
      { maxRows: MAX_ROWS, ids: dto.ids },
    );

    const arabic = Boolean(dto.arabicHeaders);
    const headers = headerLabels(CLIENT_OMS_EXPORT_COLUMNS, columnIds, arabic);

    const rows = items.map((order) => {
      const record: Record<string, unknown> = {};
      for (const id of columnIds) {
        record[id] = cell(order as unknown as Record<string, unknown>, id);
      }
      return record;
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const buffer = await buildExcelBuffer({
      sheetName: 'Online Orders',
      columns: columnIds.map((id, idx) => ({ header: headers[idx] ?? id, key: id })),
      rows,
      isRtl: arabic,
    });

    return {
      filename: `oms-orders-${stamp}.xlsx`,
      buffer,
      rowCount: items.length,
      truncated,
    };
  }
}
