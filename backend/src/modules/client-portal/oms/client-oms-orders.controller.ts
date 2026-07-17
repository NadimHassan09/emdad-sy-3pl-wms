import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOmsOrdersService } from './client-oms-orders.service';
import { ListClientOmsOrdersQueryDto } from './dto/list-client-oms-orders-query.dto';

class ClientCodReportQueryDto extends PaginationDto {
  codStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/oms')
export class ClientOmsOrdersController {
  constructor(private readonly oms: ClientOmsOrdersService) {}

  @Get('orders')
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListClientOmsOrdersQueryDto) {
    return this.oms.list(client, query);
  }

  @Get('orders/:id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.findOne(client, id);
  }

  @Get('orders/:id/timeline')
  timeline(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.oms.timeline(client, id);
  }

  @Get('cod-report')
  codReport(@ClientUser() client: ClientPrincipal, @Query() query: ClientCodReportQueryDto) {
    return this.oms.codReport(client, query);
  }
}
