import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { CompanyStatus } from '@prisma/client';

import {
  COMPANY_CITY_PATTERN,
  COMPANY_COUNTRY_PATTERN,
  COMPANY_FIELD_MESSAGES,
  COMPANY_ORG_NAME_PATTERN,
  COMPANY_PHONE_PATTERN,
} from '../company-field.validation';

function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

/** Trim; blank string → null for nullable update fields. */
function TrimEmptyToNull() {
  return Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? null : t;
  });
}

export class UpdateCompanyDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(COMPANY_ORG_NAME_PATTERN, { message: COMPANY_FIELD_MESSAGES.name })
  name?: string;

  @TrimEmptyToNull()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(COMPANY_ORG_NAME_PATTERN, { message: COMPANY_FIELD_MESSAGES.tradeName })
  tradeName?: string | null;

  @Trim()
  @IsOptional()
  @IsEmail({}, { message: COMPANY_FIELD_MESSAGES.contactEmail })
  @MaxLength(320)
  contactEmail?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(COMPANY_COUNTRY_PATTERN, { message: COMPANY_FIELD_MESSAGES.country })
  country?: string;

  @TrimEmptyToNull()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(COMPANY_CITY_PATTERN, { message: COMPANY_FIELD_MESSAGES.city })
  city?: string | null;

  @TrimEmptyToNull()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  @Matches(COMPANY_PHONE_PATTERN, { message: COMPANY_FIELD_MESSAGES.contactPhone })
  contactPhone?: string | null;

  @TrimEmptyToNull()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500, { message: COMPANY_FIELD_MESSAGES.address })
  address?: string | null;

  @TrimEmptyToNull()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000, { message: COMPANY_FIELD_MESSAGES.notes })
  notes?: string | null;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}
