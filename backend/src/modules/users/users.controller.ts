import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.findById(id);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateUserDto) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, user);
  }

  @Post(':id/suspend')
  suspend(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.suspend(id, user);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.users.remove(id, user);
  }
}
