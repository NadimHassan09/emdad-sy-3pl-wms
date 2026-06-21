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

/** Dispatch task payload — includes explicit pick binding for reservation snapshot source. */
export interface OutboundDispatchPayload {
  outbound_order_id: string;
  /** Originating completed pick task whose executionState.reservations dispatch ships. */
  pick_task_id: string;
  /** Packing area / station where cartons are staged before the shipping dock. */
  source_packing_location_id?: string;
}

/** QC task snapshot: eligible qty per inbound line post-receiving. */
export interface InboundQcTaskPayload {
  inbound_order_id: string;
  lines: Array<{ inbound_order_line_id: string; eligible_qty: string }>;
}
