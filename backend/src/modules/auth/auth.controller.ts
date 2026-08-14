import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { IsBoolean, IsOptional } from 'class-validator';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Public } from '../../common/auth/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { GoogleOAuthService } from './google-oauth.service';

class LogoutDto {
  /**
   * Soft logout keeps the remember-me refresh cookie so Continue can restore
   * the session without re-entering a password.
   */
  @IsOptional()
  @IsBoolean()
  soft?: boolean;
}

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

function assertUploadedImage(file?: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Please choose an image file to upload.');
  }
  if (!file.mimetype?.startsWith('image/')) {
    throw new BadRequestException('Only image files are allowed.');
  }
  return file;
}

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
  constructor(
    private readonly auth: AuthService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, req, res);
  }

  @Public()
  @SkipThrottle()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res, { soft: Boolean(dto?.soft) });
  }

  /** Sample protected route — requires a valid JWT and an internal (non-client) user. */
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.getProfile(user);
  }

  @Public()
  @Get('google/status')
  googleStatus() {
    return this.googleOAuth.getStatus();
  }

  /** Start Google Sign-In (linked accounts only). Redirects to Google. */
  @Public()
  @SkipThrottle()
  @Get('google/login')
  googleLogin(
    @Query('rememberMe') rememberMe: string | undefined,
    @Res() res: Response,
  ) {
    const url = this.googleOAuth.buildLoginUrl({
      rememberMe: rememberMe === '1' || rememberMe === 'true',
    });
    return res.redirect(url);
  }

  /**
   * Start Google account linking for the currently authenticated user.
   * Requires an existing password session — never auto-creates users.
   */
  @SkipThrottle()
  @Get('google/link')
  googleLink(@CurrentUser() user: AuthPrincipal, @Res() res: Response) {
    const url = this.googleOAuth.buildLinkUrl(user);
    return res.redirect(url);
  }

  @Public()
  @SkipThrottle()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.googleOAuth.handleCallback({ code, state, error }, req, res);
  }

  @Post('google/unlink')
  @HttpCode(200)
  unlinkGoogle(@CurrentUser() user: AuthPrincipal) {
    return this.googleOAuth.unlink(user);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.auth.uploadAvatar(user, assertUploadedImage(file));
  }

  @Delete('avatar')
  @HttpCode(204)
  deleteAvatar(@CurrentUser() user: AuthPrincipal) {
    return this.auth.deleteAvatar(user);
  }
}
