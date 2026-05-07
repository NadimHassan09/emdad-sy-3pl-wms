import { LocationType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateLocationDto {
  @IsUuidLoose()
  warehouseId!: string;

  @IsOptional()
  @IsUuidLoose()
  parentId?: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxWeightKg?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  maxCbm?: number;
}
