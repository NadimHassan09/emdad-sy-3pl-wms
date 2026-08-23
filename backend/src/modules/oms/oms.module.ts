import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';
import { OutboundModule } from '../outbound/outbound.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CodModule } from '../cod/cod.module';
import { ShippingModule } from '../shipping/shipping.module';
import { OmsController } from './oms.controller';
import { OmsDashboardService } from './oms-dashboard.service';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OmsOrdersCsvService } from './oms-orders-csv.service';
import { OmsOrdersService } from './oms-orders.service';
import { OmsOutboundSyncService } from './oms-outbound-sync.service';
import { OmsSalesChannelService } from './sales-channels/oms-sales-channel.service';
import { OmsWebhooksController } from './sales-channels/oms-webhooks.controller';
import { OrderAllocationService } from './order-allocation.service';

@Module({
  imports: [
    AuditModule,
    CompanyAccessModule,
    RealtimeModule,
    forwardRef(() => OutboundModule),
    forwardRef(() => CodModule),
    forwardRef(() => ShippingModule),
    forwardRef(() => ClientPortalModule),
  ],
  controllers: [OmsController, OmsWebhooksController],
  providers: [
    OrderAllocationService,
    OmsOrderEventsService,
    OmsOutboundSyncService,
    OmsOrdersService,
    OmsOrdersCsvService,
    OmsDashboardService,
    OmsSalesChannelService,
  ],
  exports: [
    OrderAllocationService,
    OmsOrderEventsService,
    OmsOutboundSyncService,
    OmsOrdersService,
  ],
})
export class OmsModule {}
