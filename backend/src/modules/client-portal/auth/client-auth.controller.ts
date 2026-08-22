import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from './client-user.decorator';
import { ClientAuthService } from './client-auth.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { JwtClientAuthGuard } from './jwt-client-auth.guard';

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
  @SkipThrottle()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: ClientLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, req, res);
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

  @Public()
  @Post('avatar')
  @UseGuards(JwtClientAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  uploadAvatar(
    @ClientUser() user: ClientPrincipal,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.auth.uploadAvatar(user, assertUploadedImage(file));
  }

  @Public()
  @Delete('avatar')
  @HttpCode(204)
  @UseGuards(JwtClientAuthGuard)
  deleteAvatar(@ClientUser() user: ClientPrincipal) {
    return this.auth.deleteAvatar(user);
  }
}
