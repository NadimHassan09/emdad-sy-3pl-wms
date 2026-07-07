import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

import { BillingInvoiceLineType } from '@prisma/client';

export class CreateInvoiceLineDto {
  @IsOptional()
  @IsEnum(BillingInvoiceLineType)
  type?: BillingInvoiceLineType;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
