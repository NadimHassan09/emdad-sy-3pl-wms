import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { UserRole, UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** Client users only — move to another company. */
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
