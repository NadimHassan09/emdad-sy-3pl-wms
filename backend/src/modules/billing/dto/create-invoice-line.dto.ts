import { Type } from 'class-transformer';
import { IsEnum, IsNumber, Min } from 'class-validator';

import { BillingInvoiceLineType } from '@prisma/client';

export class CreateInvoiceLineDto {
  @IsEnum(BillingInvoiceLineType)
  type!: BillingInvoiceLineType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
