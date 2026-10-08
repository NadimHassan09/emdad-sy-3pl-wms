import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  /** Keep a long-lived refresh session after password rotation (admin portal). */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
