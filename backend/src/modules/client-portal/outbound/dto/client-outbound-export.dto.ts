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
}
