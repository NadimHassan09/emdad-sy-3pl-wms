import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export const QUICK_DIRECTED_OUTBOUND_REASON_CODES = [
  'consumption',
  'damage',
  'sample',
  'scrap',
  'other',
] as const;

export type QuickDirectedOutboundReasonCode =
  (typeof QUICK_DIRECTED_OUTBOUND_REASON_CODES)[number];

export class QuickDirectedOutboundDto {
  @IsUuidLoose()
  warehouseId!: string;

  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /** Product barcode or SKU (case-insensitive exact match). */
  @IsString()
  @MinLength(1)
  productCode!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsIn(QUICK_DIRECTED_OUTBOUND_REASON_CODES)
  reasonCode!: QuickDirectedOutboundReasonCode;
}
