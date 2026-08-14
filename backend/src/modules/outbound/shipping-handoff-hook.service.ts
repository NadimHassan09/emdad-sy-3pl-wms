import { Injectable, Logger } from '@nestjs/common';

import { ShippingService } from '../shipping/shipping.service';

/**
 * Carrier-integration boundary.
 *
 * Called exactly when an outbound order first enters `ready_to_ship`
 * (packing complete, or picking complete when packing is not required).
 *
 * Manual shipping: no-op. Carrier: idempotent createShipment via ShippingService.
 * Failures leave outbound at ready_to_ship (dispatch stage unchanged).
 */
@Injectable()
export class ShippingHandoffHookService {
  private readonly logger = new Logger(ShippingHandoffHookService.name);

  constructor(private readonly shipping: ShippingService) {}

  async onReadyForShipping(orderId: string): Promise<void> {
    try {
      await this.shipping.ensureShipmentForOutbound(orderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`onReadyForShipping(${orderId}) failed: ${msg}`);
    }
  }
}
