import { BillingChargeKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class OnDemandIncludeDto {
  @IsBoolean() inbound!: boolean;
  @IsBoolean() outbound!: boolean;
  @IsBoolean() oms!: boolean;
  @IsBoolean() storage!: boolean;
  @IsBoolean() shipping!: boolean;
}

export class OnDemandInvoiceDto {
  @IsUuidLoose()
  companyId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @ValidateNested()
  @Type(() => OnDemandIncludeDto)
  include!: OnDemandIncludeDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ChargeRuleDto {
  @IsEnum(BillingChargeKind)
  kind!: BillingChargeKind;

  @IsBoolean()
  enabled!: boolean;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  baseFee!: number;

  @IsInt()
  @Min(0)
  @Max(10_000)
  includedLines!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  extraLineFee!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  includedWeightKg!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  extraKgFee!: number;
}

export class SaveChargeRulesDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChargeRuleDto)
  rules!: ChargeRuleDto[];
}
