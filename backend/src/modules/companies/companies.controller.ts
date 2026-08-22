import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CompaniesService } from './companies.service';
import { CustomerLifecycleService } from './customer-lifecycle.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { LifecycleActionDto } from './dto/lifecycle.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const MAX_LOGO_BYTES = 8 * 1024 * 1024;

function assertUploadedImage(file?: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Please choose an image file to upload.');
  }
  if (!file.mimetype?.startsWith('image/')) {
    throw new BadRequestException('Only image files are allowed.');
  }
  return file;
}

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly lifecycle: CustomerLifecycleService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListCompaniesQueryDto) {
    return this.companies.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.findById(user, id);
  }

  /** Lifecycle decision context: counts, blockers and which actions are allowed. */
  @Get(':id/lifecycle')
  @UseGuards(InternalAdminGuard)
  lifecycleContext(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.lifecycle.getContext(user, id);
  }

  @Post()
  @UseGuards(InternalAdminGuard)
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  @UseGuards(InternalAdminGuard)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companies.update(user, id, dto);
  }

  @Post(':id/logo')
  @UseGuards(InternalAdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_LOGO_BYTES },
    }),
  )
  uploadLogo(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.companies.uploadLogo(user, id, assertUploadedImage(file));
  }

  @Delete(':id/logo')
  @HttpCode(204)
  @UseGuards(InternalAdminGuard)
  deleteLogo(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.companies.deleteLogo(user, id);
  }

  @Post(':id/suspend')
  @UseGuards(InternalAdminGuard)
  suspend(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: LifecycleActionDto,
  ) {
    return this.lifecycle.suspend(user, id, dto?.reason);
  }

  @Post(':id/archive')
  @UseGuards(InternalAdminGuard)
  archive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: LifecycleActionDto,
  ) {
    return this.lifecycle.archive(user, id, dto?.reason);
  }

  @Post(':id/restore')
  @UseGuards(InternalAdminGuard)
  restore(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: LifecycleActionDto,
  ) {
    return this.lifecycle.restore(user, id, dto?.reason);
  }

  /** Legacy alias — marks the company as closed. Prefer /archive. */
  @Post(':id/close')
  @UseGuards(InternalAdminGuard)
  close(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.companies.softDelete(user, id);
  }

  /** Permanent purge — Super Admin only, full eligibility checks enforced server-side. */
  @Post(':id/purge')
  @UseGuards(SuperAdminGuard)
  purge(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.lifecycle.purge(user, id);
  }

  /** Scenario 1 — hard delete only when the customer has zero references anywhere. */
  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.lifecycle.hardDelete(user, id);
  }
}
