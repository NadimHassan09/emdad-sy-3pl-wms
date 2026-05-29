import { CycleCountVarianceStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { VARIANCE_REASON_CODES } from '../cycle-count-variance.constants';

const STATUSES = Object.values(CycleCountVarianceStatus) as CycleCountVarianceStatus[];

export class ListVariancesQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  cycleCountId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(STATUSES)
  status?: CycleCountVarianceStatus;
}

export class ReviewVarianceDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsIn([...VARIANCE_REASON_CODES])
  reasonCode?: (typeof VARIANCE_REASON_CODES)[number];

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  reviewNotes?: string;
}
