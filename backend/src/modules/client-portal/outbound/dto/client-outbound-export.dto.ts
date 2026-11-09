import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { IsUuidLoose } from '../../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Client Portal outbound CSV export — selected ids OR current list filters. */
export class ClientOutboundOrdersExportDto {
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
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;

  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx';
}
