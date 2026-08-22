import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateFinalContractDto } from './dto/create-final-contract.dto';
import { ListFinalContractsQueryDto } from './dto/list-final-contracts-query.dto';
import { UpdateFinalContractDto } from './dto/update-final-contract.dto';
import { FinalContractsService } from './final-contracts.service';

@Controller('final-contracts')
export class FinalContractsController {
  constructor(private readonly finalContracts: FinalContractsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListFinalContractsQueryDto) {
    return this.finalContracts.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.finalContracts.findById(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateFinalContractDto) {
    return this.finalContracts.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateFinalContractDto,
  ) {
    return this.finalContracts.update(user, id, dto);
  }
}
