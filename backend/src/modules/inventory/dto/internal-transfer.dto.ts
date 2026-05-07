import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class InternalTransferDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  productId!: string;

  /** Required when the product is lot-tracked. */
  @IsOptional()
  @IsUuidLoose()
  lotId?: string;

  @IsUuidLoose()
  fromLocationId!: string;

  @IsUuidLoose()
  toLocationId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;
}
