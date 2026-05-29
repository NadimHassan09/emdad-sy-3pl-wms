import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CycleCountVarianceService } from './cycle-count-variance.service';
import { ListVariancesQueryDto, ReviewVarianceDto } from './dto/variance.dto';

@Controller('cycle-count/variances')
export class CycleCountVarianceController {
  constructor(private readonly variances: CycleCountVarianceService) {}

  @Get('reason-codes')
  listReasonCodes() {
    return this.variances.listReasonCodes();
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListVariancesQueryDto) {
    return this.variances.list(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.variances.findById(user, id);
  }

  @Patch(':id/review')
  @UseGuards(InternalAdminGuard)
  review(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ReviewVarianceDto,
  ) {
    return this.variances.review(user, id, dto);
  }
}
