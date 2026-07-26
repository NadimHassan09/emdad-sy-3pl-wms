import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  COMPANY_CITY_PATTERN,
  COMPANY_COUNTRY_PATTERN,
  COMPANY_FIELD_MESSAGES,
  COMPANY_ORG_NAME_PATTERN,
  COMPANY_PHONE_PATTERN,
} from '../company-field.validation';

/** Trim strings before validation. */
function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

/** Trim; treat blank optional strings as undefined so @IsOptional skips further checks. */
function TrimEmptyToUndefined() {
  return Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  });
}

export class CreateCompanyDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(COMPANY_ORG_NAME_PATTERN, { message: COMPANY_FIELD_MESSAGES.name })
  name!: string;

  @TrimEmptyToUndefined()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(COMPANY_ORG_NAME_PATTERN, { message: COMPANY_FIELD_MESSAGES.tradeName })
  tradeName?: string;

  @Trim()
  @IsEmail({}, { message: COMPANY_FIELD_MESSAGES.contactEmail })
  @MaxLength(320)
  contactEmail!: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(COMPANY_COUNTRY_PATTERN, { message: COMPANY_FIELD_MESSAGES.country })
  country!: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(COMPANY_CITY_PATTERN, { message: COMPANY_FIELD_MESSAGES.city })
  city!: string;

  @TrimEmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(COMPANY_PHONE_PATTERN, { message: COMPANY_FIELD_MESSAGES.contactPhone })
  contactPhone?: string;

  @TrimEmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: COMPANY_FIELD_MESSAGES.address })
  address?: string;

  @TrimEmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: COMPANY_FIELD_MESSAGES.notes })
  notes?: string;
}
