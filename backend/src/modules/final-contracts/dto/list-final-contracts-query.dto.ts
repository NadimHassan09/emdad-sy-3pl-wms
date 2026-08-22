import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListFinalContractsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['pending', 'generated', 'complete'])
  generationStatus?: 'pending' | 'generated' | 'complete';

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'issueFrom must be YYYY-MM-DD' })
  issueFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'issueTo must be YYYY-MM-DD' })
  issueTo?: string;
}
