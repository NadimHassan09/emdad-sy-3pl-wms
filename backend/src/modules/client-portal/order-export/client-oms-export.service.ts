import { BadRequestException, Injectable } from '@nestjs/common';
import { OmsOrderStatus } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ClientOmsOrdersExportDto } from '../oms/dto/bulk-confirm-client-oms-orders.dto';
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

@Injectable()
export class ClientOmsExportService {
  constructor(private readonly oms: ClientOmsOrdersService) {}

  columns() {
    return CLIENT_OMS_EXPORT_COLUMNS;
  }

  async exportCsv(client: ClientPrincipal, dto: ClientOmsOrdersExportDto) {
    const columnIds = orderedColumnIds(CLIENT_OMS_EXPORT_COLUMNS, dto.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, truncated } = await this.oms.listForExport(
      client,
      {
        orderSearch: dto.orderSearch,
        status: dto.status as OmsOrderStatus | undefined,
        storeChannel: dto.storeChannel,
        createdFrom: dto.createdFrom,
        createdTo: dto.createdTo,
      },
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
}
