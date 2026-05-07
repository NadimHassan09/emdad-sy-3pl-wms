import { IsNumber, IsOptional, Min } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AddAdjustmentLineDto {
  @IsUuidLoose()
  productId!: string;

  @IsUuidLoose()
  locationId!: string;

  /** Required when product is lot-tracked; must be an existing lot UUID (no server-side lot creation). */
  @IsOptional()
  @IsUuidLoose()
  lotId?: string;

  /** Target quantity on hand after this adjustment is approved. */
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantityAfter!: number;
}
