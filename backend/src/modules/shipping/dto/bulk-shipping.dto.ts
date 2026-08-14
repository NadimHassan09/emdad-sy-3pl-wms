import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BulkShippingPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  outboundOrderIds!: string[];
}

export class BulkShippingConfirmItemDto {
  @IsUUID('4')
  outboundOrderId!: string;

  /** MANUAL or a connected provider code (e.g. BABEL_EXPRESS). */
  @IsString()
  @MaxLength(64)
  providerCode!: string;

  @IsOptional()
  quotedPrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  quotedCurrency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  recommendedProviderCode?: string | null;
}

export class BulkShippingConfirmDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkShippingConfirmItemDto)
  items!: BulkShippingConfirmItemDto[];
}
