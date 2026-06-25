import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { Public } from '../../common/auth/public.decorator';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { ListLeadFormsQueryDto } from './dto/list-lead-forms-query.dto';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  /**
   * Public lead-capture endpoint for external landing pages.
   * Unauthenticated, tightly rate-limited (10 submissions / minute / IP).
   */
  @Public()
  @Post('submit')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(@Body() dto: CreateLeadFormDto, @Req() req: Request) {
    return this.forms.submit(dto, {
      ip: req.ip,
      origin: (req.headers.origin as string | undefined) ?? undefined,
    });
  }

  @Get()
  @UseGuards(InternalAdminGuard)
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListLeadFormsQueryDto) {
    return this.forms.list(user, query);
  }

  @Get('activity-types')
  @UseGuards(InternalAdminGuard)
  activityTypes() {
    return this.forms.activityTypes();
  }

  @Get(':id')
  @UseGuards(InternalAdminGuard)
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.forms.findById(id);
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.forms.remove(id, user);
  }
}
