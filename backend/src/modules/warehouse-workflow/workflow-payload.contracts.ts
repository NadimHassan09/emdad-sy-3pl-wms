/** JSON payload shapes persisted on warehouse_tasks.payload (shared contracts). */

export interface InboundReceivingPayload {
  inbound_order_id: string;
  lines: Array<{
    inbound_order_line_id: string;
    expected_qty: string;
    staging_location_id: string;
  }>;
}

export interface InboundPutawayPayload {
  inbound_order_id: string;
  lines: Array<{
    inbound_order_line_id: string;
    product_id: string;
    quantity: string;
    lot_id?: string | null;
    source_staging_location_id: string;
  }>;
}

export interface OutboundPickPayload {
  outbound_order_id: string;
  lines: Array<{ outbound_order_line_id: string; requested_qty: string }>;
}

/** QC task snapshot: eligible qty per inbound line post-receiving. */
export interface InboundQcTaskPayload {
  inbound_order_id: string;
  lines: Array<{ inbound_order_line_id: string; eligible_qty: string }>;
}
