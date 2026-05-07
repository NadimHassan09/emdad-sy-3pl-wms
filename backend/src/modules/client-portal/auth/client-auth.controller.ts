import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientUser } from './client-user.decorator';
import { ClientAuthService } from './client-auth.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { JwtClientAuthGuard } from './jwt-client-auth.guard';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';

/**
 * Client portal auth (separate JWT from internal WMS).
 *
 * - `POST /api/client/auth/login` — client_admin / client_staff only.
 * - `GET /api/client/auth/me` — current client + company (scoped to their tenant).
 * - `POST /api/client/auth/logout` — clears HttpOnly cookie.
 */
@Controller('client/auth')
export class ClientAuthController {
  constructor(private readonly auth: ClientAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: ClientLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('client_access_token', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  @Public()
  @Get('me')
  @UseGuards(JwtClientAuthGuard)
  me(@ClientUser() user: ClientPrincipal) {
    return this.auth.getMe(user);
  }
}
