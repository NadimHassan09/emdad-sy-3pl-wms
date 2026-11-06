import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { UpsertGoogleOAuthDto } from './dto/upsert-google-oauth.dto';
import { SettingsService } from './settings.service';

@UseGuards(SuperAdminGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('google-oauth')
  getGoogleOAuth() {
    return this.svc.getGoogleOAuth();
  }

  @Put('google-oauth')
  upsertGoogleOAuth(@CurrentUser() user: AuthPrincipal, @Body() dto: UpsertGoogleOAuthDto) {
    return this.svc.upsertGoogleOAuth(user.id, dto);
  }

  @Post('google-oauth/test')
  testGoogleOAuth() {
    return this.svc.testGoogleOAuth();
  }
}
