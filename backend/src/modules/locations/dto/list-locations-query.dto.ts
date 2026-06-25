import { LocationStatus, LocationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const LOCATION_TYPES = Object.values(LocationType) as LocationType[];
const LOCATION_STATUSES = Object.values(LocationStatus) as LocationStatus[];

function QueryTrimmedString() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  });
}

export class ListLocationsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  /** Direct children of this parent. Omit to list root locations (`parent_id IS NULL`) only. */
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  parentId?: string;

  @QueryTrimmedString()
  @IsOptional()
  @IsString()
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(LOCATION_TYPES)
  type?: LocationType;

  /**
   * @deprecated Prefer `status`. When true and `status` is omitted, archived/blocked rows are included.
   */
  @QueryBoolOptional()
  @IsOptional()
  includeArchived?: boolean;
}
