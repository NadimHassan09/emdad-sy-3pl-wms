import { LedgerRefType, MovementType, StockStatus } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined, QueryBoolOptional } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const MOVEMENT_TYPES = Object.values(MovementType) as MovementType[];
const MOVEMENT_FILTERS = [
  ...MOVEMENT_TYPES,
  'inbound',
  'outbound',
  'return',
  'adjustment',
  'transfer',
] as const;
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

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(Object.values(StockStatus))
  status?: StockStatus;

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

  /** Substring match on product name, SKU, or barcode. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productSearch?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productName?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  sku?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  productBarcode?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(MOVEMENT_FILTERS)
  movementType?: MovementType | 'inbound' | 'outbound' | 'return' | 'adjustment' | 'transfer';

  /** When true, include adjustments, transfers, scrap, QC (internal audit movements). */
  @QueryBoolOptional()
  @IsOptional()
  @IsBoolean()
  includeInternal?: boolean;

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

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  operatorId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  locationId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  lotId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  lotNumber?: string;

  /** Match operator full name (case-insensitive substring). */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  operatorSearch?: string;

  /** Match reference UUID text or inbound/outbound/return order number. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  referenceSearch?: string;
}
