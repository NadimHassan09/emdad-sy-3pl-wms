import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

/** Trim query strings so `+`/spaces do not bypass filters or confuse validators. */
function QueryTrimmedString() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  });
}

export class ListProductsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  search?: string;

  /** Substring filter on product name (case-insensitive). Named `productName` to avoid query/`name` collisions. */
  @QueryTrimmedString()
  @IsOptional()
  @IsString()
  productName?: string;

  /** Substring filter on SKU (case-insensitive). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  sku?: string;

  /** Substring filter on barcode (case-insensitive). */
  @QueryTrimmedString()
  @IsOptional()
  @IsString()
  productBarcode?: string;

  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
