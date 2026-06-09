import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListBillingPlansQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /** Case-insensitive substring on client name. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['active', 'renewed', 'expired', 'none'])
  cycleStatus?: 'active' | 'renewed' | 'expired' | 'none';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['critical', 'warning', 'healthy', 'expired', 'none'])
  daysRemaining?: 'critical' | 'warning' | 'healthy' | 'expired' | 'none';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['operational', 'restricted', 'inactive'])
  billingStatus?: 'operational' | 'restricted' | 'inactive';

  /** Filter cycles ending on or after this date (YYYY-MM-DD). */
  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'expiryFrom must be YYYY-MM-DD' })
  expiryFrom?: string;

  /** Filter cycles ending on or before this date (YYYY-MM-DD). */
  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'expiryTo must be YYYY-MM-DD' })
  expiryTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn([
    'companyName',
    'cycleStart',
    'cycleEnd',
    'daysRemaining',
    'cycleLengthDays',
    'fixedSubscriptionFee',
    'createdAt',
  ])
  sort_by?:
    | 'companyName'
    | 'cycleStart'
    | 'cycleEnd'
    | 'daysRemaining'
    | 'cycleLengthDays'
    | 'fixedSubscriptionFee'
    | 'createdAt';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';
}
