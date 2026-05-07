import { IsDateString, IsOptional } from 'class-validator';

import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class LedgerEntryQueryDto {
  @IsUuidLoose()
  ledgerId!: string;

  /** ISO-8601 timestamp matching `inventory_ledger.created_at` (composite PK with ledgerId). */
  @IsDateString()
  createdAt!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  warehouseId?: string;
}
