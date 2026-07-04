import { DocumentType } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../common/transformers/query-transform';
import { IsUuidLoose } from '../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListContractsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /** Substring on document number, order number, or document UUID. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(Object.values(DocumentType))
  type?: DocumentType;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['en', 'ar'])
  language?: 'en' | 'ar';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['inbound_order', 'outbound_order'])
  referenceType?: 'inbound_order' | 'outbound_order';

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;
}
