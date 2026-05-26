import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListCompaniesQueryDto) {
    return this.companies.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.findById(user, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companies.update(user, id, dto);
  }

  @Post(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  suspend(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.suspend(user, id);
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  close(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.softDelete(user, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.remove(user, id);
  }
}
