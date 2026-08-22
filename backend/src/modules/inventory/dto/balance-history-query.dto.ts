import { IsOptional, IsString, Matches } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class BalanceHistoryQueryDto {
  @IsUuidLoose()
  productId!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}
