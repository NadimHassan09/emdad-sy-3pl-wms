import { IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AvailabilityQueryDto {
  @IsUuidLoose()
  productId!: string;

  @IsOptional()
  @IsUuidLoose()
  companyId?: string;
}
