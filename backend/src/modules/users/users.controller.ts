import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertCustomRoleDto } from './dto/custom-role.dto';
import { UpsertUserWorkerProfileDto } from './dto/upsert-user-worker-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(InternalAdminGuard)
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListUsersQueryDto) {
    return this.users.list(user, query);
  }

  /** O-11 — must be declared before `:id` routes. */
  @Get('custom-roles')
  @UseGuards(InternalAdminGuard)
  listCustomRoles(@CurrentUser() user: AuthPrincipal) {
    return this.users.listCustomRoles(user);
  }

  @Post('custom-roles')
  @UseGuards(InternalAdminGuard)
  createCustomRole(@CurrentUser() user: AuthPrincipal, @Body() dto: UpsertCustomRoleDto) {
    return this.users.createCustomRole(user, dto);
  }

  @Patch('custom-roles/:roleId')
  @UseGuards(InternalAdminGuard)
  updateCustomRole(
    @CurrentUser() user: AuthPrincipal,
    @Param('roleId', ParseUuidLoosePipe) roleId: string,
    @Body() dto: UpsertCustomRoleDto,
  ) {
    return this.users.updateCustomRole(user, roleId, dto);
  }

  @Delete('custom-roles/:roleId')
  @UseGuards(InternalAdminGuard)
  deleteCustomRole(
    @CurrentUser() user: AuthPrincipal,
    @Param('roleId', ParseUuidLoosePipe) roleId: string,
  ) {
    return this.users.deleteCustomRole(user, roleId);
  }

  @Get(':id/worker-profile')
  @UseGuards(InternalAdminGuard)
  getWorkerProfile(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.getWorkerProfile(id, user);
  }

  @Put(':id/worker-profile')
  @UseGuards(InternalAdminGuard)
  upsertWorkerProfile(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpsertUserWorkerProfileDto,
  ) {
    return this.users.upsertWorkerProfile(id, dto, user);
  }

  @Get(':id')
  @UseGuards(InternalAdminGuard)
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.findById(id, user);
  }

  @Post()
  @UseGuards(InternalAdminGuard)
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateUserDto) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(InternalAdminGuard)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, user);
  }

  @Post(':id/suspend')
  @UseGuards(InternalAdminGuard)
  suspend(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.suspend(id, user);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.remove(id, user);
  }
}
