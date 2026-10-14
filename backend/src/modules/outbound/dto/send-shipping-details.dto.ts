import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';

/** Optional fresh quote fingerprint — skip live re-quote only when all fields match. */
export class QuoteFingerprintDto {
  @IsString()
  @MaxLength(64)
  providerCode!: string;

  @IsString()
  @MaxLength(128)
  serviceId!: string;

  @IsString()
  @MaxLength(8)
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @MaxLength(16)
  deliveryType!: string;

  @IsString()
  @MaxLength(16)
  packageType!: string;

  @Type(() => Number)
  @IsNumber()
  weightKg!: number;

  @IsString()
  @MaxLength(500)
  destinationKey!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  partsKey?: string;

  @IsString()
  @MaxLength(40)
  quotedAt!: string;

  @IsString()
  @MaxLength(40)
  expiresAt!: string;
}

export class SendShippingDetailsDto {
  @EmptyToUndefined()
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteFingerprintDto)
  quoteFingerprint?: QuoteFingerprintDto | null;
}
