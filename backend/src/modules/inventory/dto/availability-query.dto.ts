import { IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AvailabilityQueryDto {
  @IsUuidLoose()
  productId!: string;

  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /**
   * When set, `available` includes this outbound's own active soft-holds for the product
   * (OMS→Outbound linked reservation reuse — do not treat own hold as unavailable).
   */
  @IsOptional()
  @IsUuidLoose()
  outboundOrderId?: string;
}
