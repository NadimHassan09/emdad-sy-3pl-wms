import { BadRequestException, Injectable } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { buildExcelBuffer, ExcelExportColumn } from '../../../common/utils/excel-export.util';
import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import { ClientInboundOrdersService } from '../inbound/client-inbound-orders.service';
import { ClientInboundOrdersExportDto } from '../inbound/dto/client-inbound-export.dto';
import { exportProductNames, exportProductWeights } from '../../oms/order-export-product-cells';
import {
  CLIENT_INBOUND_EXPORT_COLUMNS,
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
    case 'expected_arrival_date':
      return order.expectedArrivalDate
        ? new Date(String(order.expectedArrivalDate)).toISOString().slice(0, 10)
        : '';
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
    case 'completed_at':
      return order.completedAt ? new Date(String(order.completedAt)).toISOString() : '';
    default:
      return '';
  }
}

@Injectable()
export class ClientInboundExportService {
  constructor(private readonly inbound: ClientInboundOrdersService) {}

  columns() {
    return CLIENT_INBOUND_EXPORT_COLUMNS;
  }

  async exportCsv(client: ClientPrincipal, dto: ClientInboundOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_INBOUND_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.inbound.listForExport(
      client,
      { orderSearch: dto.orderSearch, status: dto.status },
      { maxRows: MAX_ROWS, ids: dto.ids },
    );

    const arabic = Boolean(dto.arabicHeaders);
    const headers = headerLabels(CLIENT_INBOUND_EXPORT_COLUMNS, columnIds, arabic);
    const rows = items.map((order) =>
      columnIds.map((id) => cell(order as unknown as Record<string, unknown>, id)),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `inbound-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated,
    };
  }

  async exportXlsx(client: ClientPrincipal, dto: ClientInboundOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_INBOUND_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.inbound.listForExport(
      client,
      { orderSearch: dto.orderSearch, status: dto.status },
      { maxRows: MAX_ROWS, ids: dto.ids },
    );

    const arabic = Boolean(dto.arabicHeaders);
    const headers = headerLabels(CLIENT_INBOUND_EXPORT_COLUMNS, columnIds, arabic);
    const columns: ExcelExportColumn[] = columnIds.map((id, idx) => ({
      header: headers[idx] ?? id,
      key: id,
    }));
    const rows = items.map((order) => {
      const rowObj: Record<string, string> = {};
      for (const id of columnIds) {
        rowObj[id] = cell(order as unknown as Record<string, unknown>, id);
      }
      return rowObj;
    });

    const buffer = await buildExcelBuffer({
      sheetName: 'Inbound Orders',
      columns,
      rows,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `inbound-orders-${stamp}.xlsx`,
      buffer,
      rowCount: items.length,
      truncated,
    };
  }
}
