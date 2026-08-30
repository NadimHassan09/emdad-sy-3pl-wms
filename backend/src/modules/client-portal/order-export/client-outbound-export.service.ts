import { BadRequestException, Injectable } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import { ClientOutboundOrdersService } from '../outbound/client-outbound-orders.service';
import { ClientOutboundOrdersExportDto } from '../outbound/dto/client-outbound-export.dto';
import { exportProductNames, exportProductWeights } from '../../oms/order-export-product-cells';
import {
  CLIENT_OUTBOUND_EXPORT_COLUMNS,
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
    case 'destination':
      return String(order.destinationAddress ?? '');
    case 'recipient_name':
      return String(order.recipientName ?? '');
    case 'required_ship_date':
      return order.requiredShipDate
        ? new Date(String(order.requiredShipDate)).toISOString().slice(0, 10)
        : '';
    case 'carrier':
      return String(order.carrier ?? '');
    case 'tracking_number':
      return String(order.trackingNumber ?? '');
    case 'lines':
      return String(Array.isArray(order.lines) ? order.lines.length : '');
    case 'product_name':
      return exportProductNames(order.lines);
    case 'product_weight':
      return exportProductWeights(order.lines);
    case 'notes':
      return String(order.notes ?? '');
    case 'created_at':
      return order.createdAt ? new Date(String(order.createdAt)).toISOString() : '';
    case 'confirmed_at':
      return order.confirmedAt ? new Date(String(order.confirmedAt)).toISOString() : '';
    case 'shipped_at':
      return order.shippedAt ? new Date(String(order.shippedAt)).toISOString() : '';
    default:
      return '';
  }
}

@Injectable()
export class ClientOutboundExportService {
  constructor(private readonly outbound: ClientOutboundOrdersService) {}

  columns() {
    return CLIENT_OUTBOUND_EXPORT_COLUMNS;
  }

  async exportCsv(client: ClientPrincipal, dto: ClientOutboundOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_OUTBOUND_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.outbound.listForExport(
      client,
      { orderSearch: dto.orderSearch, status: dto.status },
      { maxRows: MAX_ROWS, ids: dto.ids },
    );

    const arabic = Boolean(dto.arabicHeaders);
    const headers = headerLabels(CLIENT_OUTBOUND_EXPORT_COLUMNS, columnIds, arabic);
    const rows = items.map((order) =>
      columnIds.map((id) => cell(order as unknown as Record<string, unknown>, id)),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `outbound-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated,
    };
  }
}
