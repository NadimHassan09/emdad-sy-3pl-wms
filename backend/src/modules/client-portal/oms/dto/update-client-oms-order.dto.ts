import { OmsPaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsRecipientName, IsRecipientPhone } from '../../../../common/validators/is-recipient-contact';

/** What a client may change on an order that the admin has not approved yet. */
export class UpdateClientOmsOrderDto {
  @IsOptional()
  @IsDateString()
  requiredShipDate?: string;

  @IsOptional()
  @IsString()
  @IsRecipientName()
  recipientName?: string;

  @IsOptional()
  @IsString()
  @IsRecipientPhone()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MinLength(11, { message: 'Street / detailed address must be more than 10 characters.' })
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes must be at most 500 characters.' })
  notes?: string;

  @IsOptional()
  @IsEnum(OmsPaymentMethod)
  paymentMethod?: OmsPaymentMethod;
}
