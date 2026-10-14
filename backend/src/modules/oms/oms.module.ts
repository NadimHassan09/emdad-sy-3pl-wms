import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { CompanyAccessModule } from '../../common/company-access/company-access.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';
import { OutboundModule } from '../outbound/outbound.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CodModule } from '../cod/cod.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PdfModule } from '../../pdf/pdf.module';
import { OmsController } from './oms.controller';
import { OmsBulkService } from './oms-bulk.service';
import { OmsDashboardService } from './oms-dashboard.service';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OmsOrdersCsvService } from './oms-orders-csv.service';
import { OmsOrdersService } from './oms-orders.service';
import { OmsOutboundSyncService } from './oms-outbound-sync.service';
import { OmsSalesChannelService } from './sales-channels/oms-sales-channel.service';
import { OmsWebhooksController } from './sales-channels/oms-webhooks.controller';
import { OrderAllocationService } from './order-allocation.service';
import { OmsWaybillService } from './oms-waybill.service';
import { OmsInstructionPdfService } from './oms-instruction-pdf.service';
import { OmsBatchController } from './oms-batch.controller';
import { OmsBatchService } from './oms-batch.service';

@Module({
  imports: [
    AuditModule,
    CompanyAccessModule,
    RealtimeModule,
    PdfModule,
    forwardRef(() => OutboundModule),
    forwardRef(() => CodModule),
    forwardRef(() => ShippingModule),
    forwardRef(() => ClientPortalModule),
  ],
  controllers: [OmsController, OmsBatchController, OmsWebhooksController],
  providers: [
    OrderAllocationService,
    OmsOrderEventsService,
    OmsOutboundSyncService,
    OmsOrdersService,
    OmsBulkService,
    OmsOrdersCsvService,
    OmsDashboardService,
    OmsSalesChannelService,
    OmsWaybillService,
    OmsInstructionPdfService,
    OmsBatchService,
  ],
  exports: [
    OrderAllocationService,
    OmsOrderEventsService,
    OmsOutboundSyncService,
    OmsOrdersService,
    OmsWaybillService,
  ],
})
export class OmsModule {}
