import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CompanyStatus } from '@prisma/client';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
