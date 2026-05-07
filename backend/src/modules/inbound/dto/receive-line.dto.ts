import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ReceiveLineDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsUuidLoose()
  locationId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  /**
   * Set true to bypass the lot-lock when the inbound line was created with
   * an `expectedLotNumber`. Default false.
   */
  @IsOptional()
  @IsBoolean()
  overrideLot?: boolean;
}
