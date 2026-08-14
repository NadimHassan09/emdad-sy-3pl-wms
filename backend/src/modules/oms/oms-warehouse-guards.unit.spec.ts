import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import {
  OMS_BLOCKS_WAREHOUSE_EXECUTION,
  omsBlocksWarehouseExecution,
  outboundAllowsShippingDetailsSpawn,
  outboundWarehouseClosed,
} from './oms-warehouse-guards';

describe('oms-warehouse-guards', () => {
  it('blocks warehouse execution for commercial shipped/delivered/returned/cancelled', () => {
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.shipped)).toBe(true);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.out_for_delivery)).toBe(true);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.delivered)).toBe(true);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.returned)).toBe(true);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.cancelled)).toBe(true);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.processing)).toBe(false);
    expect(omsBlocksWarehouseExecution(OmsOrderStatus.pending)).toBe(false);
  });

  it('treats externally_fulfilled and shipped outbound as warehouse-closed', () => {
    expect(outboundWarehouseClosed(OutboundOrderStatus.externally_fulfilled)).toBe(true);
    expect(outboundWarehouseClosed(OutboundOrderStatus.shipped)).toBe(true);
    expect(outboundWarehouseClosed(OutboundOrderStatus.draft)).toBe(false);
    expect(outboundWarehouseClosed(OutboundOrderStatus.allocated)).toBe(false);
  });

  it('only allows shipping_details spawn from prep statuses', () => {
    expect(outboundAllowsShippingDetailsSpawn('picking')).toBe(true);
    expect(outboundAllowsShippingDetailsSpawn('packing')).toBe(true);
    expect(outboundAllowsShippingDetailsSpawn('waiting_for_shipping_details')).toBe(true);
    expect(outboundAllowsShippingDetailsSpawn('ready_to_ship')).toBe(false);
    expect(outboundAllowsShippingDetailsSpawn('shipped')).toBe(false);
    expect(outboundAllowsShippingDetailsSpawn('externally_fulfilled')).toBe(false);
  });

  it('exposes the same set used by confirm and carrier guards', () => {
    expect(OMS_BLOCKS_WAREHOUSE_EXECUTION.has(OmsOrderStatus.failed_delivery)).toBe(true);
  });
});
