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

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ListOmsOrdersQueryDto } from './list-oms-orders-query.dto';

/** POST /oms/orders/export — column picker + optional ids. */
export class OmsOrdersExportDto extends ListOmsOrdersQueryDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  columnIds?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  arabicHeaders?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUuidLoose({ each: true })
  ids?: string[];
}
