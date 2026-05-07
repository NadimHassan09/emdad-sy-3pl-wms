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
  list(@Query() query: ListCompaniesQueryDto) {
    return this.companies.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUuidLoosePipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }

  @Post(':id/suspend')
  suspend(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.suspend(id);
  }

  @Post(':id/close')
  close(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.softDelete(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  remove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.remove(id);
  }
}
