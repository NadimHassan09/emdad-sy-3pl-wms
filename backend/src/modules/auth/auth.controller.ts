import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Public } from '../../common/auth/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * ## Example: login
 * `POST /api/auth/login`
 * ```json
 * { "email": "superadmin@emdad.example", "password": "demo123" }
 * ```
 * **200** body (after global envelope): `data.access_token`, `data.user`, `Set-Cookie: access_token=…; HttpOnly`
 *
 * ## Example: protected route
 * `GET /api/auth/me` with header `Authorization: Bearer <access_token>`
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  /** Sample protected route — requires a valid JWT and an internal (non-client) user. */
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.getProfile(user);
  }
}
