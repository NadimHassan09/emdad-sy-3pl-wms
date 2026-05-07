import { LocationStatus, LocationType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';


export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxWeightKg?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  maxCbm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPalletPositions?: number;
}
