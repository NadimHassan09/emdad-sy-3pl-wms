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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListUsersQueryDto) {
    return this.users.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.findById(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateUserDto) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, user);
  }

  @Post(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  suspend(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.suspend(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.remove(id, user);
  }
}
