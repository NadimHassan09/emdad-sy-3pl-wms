import { LedgerRefType, MovementType } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const MOVEMENT_TYPES = Object.values(MovementType) as MovementType[];
const MOVEMENT_FILTERS = [...MOVEMENT_TYPES, 'inbound', 'outbound', 'adjustment'] as const;
const REF_TYPES = Object.values(LedgerRefType) as LedgerRefType[];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class StockQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  productId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  locationId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  sku?: string;

  /** Matches product name or SKU (case-insensitive substring). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productSearch?: string;

  /** Substring match on product name (AND with sku / productBarcode when used). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productName?: string;

  /** Substring match on product barcode. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productBarcode?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  packageId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  inboundOrderId?: string;

  /** Substring match on inbound order number; narrows stock via receive ledger rows for matching orders. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  inboundOrderNumber?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  locationBarcodeOrId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  lotNumber?: string;
}

export class LedgerQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  productId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(MOVEMENT_FILTERS)
  movementType?: MovementType | 'inbound' | 'outbound' | 'adjustment';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(REF_TYPES)
  referenceType?: LedgerRefType;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  referenceId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;
}
