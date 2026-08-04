import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ClientLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  /** Persist session for 30 days (HttpOnly cookie + JWT lifetime). */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
