import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/** Trim incoming strings before validation so blank-only fields are rejected. */
function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

/**
 * Public lead-capture payload submitted by external HTML landing pages.
 * No authentication; all fields are validated and trimmed.
 */
export class CreateLeadFormDto {
  @Trim()
  @IsString()
  @Length(2, 150)
  fullName!: string;

  @Trim()
  @IsString()
  @Length(5, 30)
  @Matches(/^[+]?[\d\s()-]{5,30}$/, {
    message: 'phone must be a valid phone number.',
  })
  phone!: string;

  @Trim()
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @Length(3, 200)
  email!: string;

  @Trim()
  @IsString()
  @Length(2, 100)
  activityType!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  message?: string;
}
