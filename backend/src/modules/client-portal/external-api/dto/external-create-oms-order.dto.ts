import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmsPaymentMethod } from '@prisma/client';

import { IsRecipientName } from '../../../../common/validators/is-recipient-contact';

export class ExternalOmsAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Governorate is required.' })
  @MaxLength(80)
  governorate!: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required.' })
  @MaxLength(80)
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'Neighborhood is required.' })
  @MaxLength(80)
  neighborhood!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;
}

export class ExternalOmsLineDto {
  @IsString()
  @IsNotEmpty({ message: 'Product SKU is required.' })
  @MaxLength(80)
  sku!: string;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number (no decimals).' })
  @IsPositive({ message: 'Quantity must be a positive whole number.' })
  quantity!: number;

  @Type(() => Number)
  @IsInt({ message: 'Unit price must be a whole number (no decimals).' })
  @Min(0, { message: 'Unit price cannot be negative.' })
  unitPrice!: number;
}

/**
 * External OMS create — same business fields as Client Portal create + CSV import.
 * `product_name` is not accepted (product is resolved by SKU only).
 * Currency is always USD.
 */
export class ExternalCreateOmsOrderDto {
  /** Customer reference / idempotency key (CSV: order_number). */
  @IsString()
  @IsNotEmpty({ message: 'externalOrderId is required.' })
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message:
      'externalOrderId may only contain English letters, English digits (0-9), and hyphen (-).',
  })
  externalOrderId!: string;

  /** YYYY-MM-DD or M/DD/YYYY (English digits). */
  @IsString()
  @IsNotEmpty({ message: 'requiredShipDate is required.' })
  requiredShipDate!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ExternalOmsAddressDto)
  address!: ExternalOmsAddressDto;

  @IsString()
  @IsNotEmpty({ message: 'Recipient name is required.' })
  @IsRecipientName()
  recipientName!: string;

  /**
   * Numeric dialing code only (CSV: country_code), e.g. "963".
   * No "+", letters, or symbols.
   */
  @IsString()
  @IsNotEmpty({ message: 'countryCode is required.' })
  @Matches(/^[0-9]+$/, {
    message:
      'countryCode must be English digits only (example: 963). Do not include +, letters, or symbols.',
  })
  @MaxLength(8)
  countryCode!: string;

  /**
   * National phone digits only (CSV: recipient_phone).
   * No "+", spaces, letters, or symbols.
   */
  @IsString()
  @IsNotEmpty({ message: 'Recipient phone is required.' })
  @Matches(/^[0-9]+$/, {
    message:
      'recipientPhone must be English digits only (no +, spaces, letters, or symbols).',
  })
  @MaxLength(20)
  recipientPhone!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(OmsPaymentMethod, {
    message: 'paymentMethod must be exactly one of: COD, Prepaid, or Credit.',
  })
  paymentMethod!: OmsPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalOmsLineDto)
  lines!: ExternalOmsLineDto[];
}
