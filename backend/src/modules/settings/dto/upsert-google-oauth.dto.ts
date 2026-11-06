import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpsertGoogleOAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  clientSecret?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(512)
  redirectUri?: string;
}
