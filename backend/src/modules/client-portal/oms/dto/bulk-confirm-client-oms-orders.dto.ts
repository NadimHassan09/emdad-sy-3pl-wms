import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { IsUuidLoose } from '../../../../common/validators/is-uuid-loose';

export class BulkConfirmClientOmsOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUuidLoose({ each: true })
  ids!: string[];
}

export class BulkCancelClientOmsOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUuidLoose({ each: true })
  ids!: string[];
}

/** Client Portal CSV export — selected ids OR current list filters. */
export class ClientOmsOrdersExportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  columnIds!: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  arabicHeaders?: boolean;

  /** When set, export only these orders (ignore filters). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUuidLoose({ each: true })
  ids?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderSearch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  startOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  endOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  totalOp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  totalValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  operationalStage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  createdFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  createdTo?: string;

  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx';
}
