import { BillingCycleStatus, BillingInvoiceStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INVOICE_STATUSES = Object.values(BillingInvoiceStatus);
const CYCLE_STATUSES = Object.values(BillingCycleStatus);

export class ListBillingInvoicesQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  /** Substring match on invoice_number. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: BillingInvoiceStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(CYCLE_STATUSES)
  cycleStatus?: BillingCycleStatus;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdFrom must be YYYY-MM-DD' })
  createdFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'createdTo must be YYYY-MM-DD' })
  createdTo?: string;

  /** Billing cycle end date on or after (YYYY-MM-DD). */
  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'expiryFrom must be YYYY-MM-DD' })
  expiryFrom?: string;

  /** Billing cycle end date on or before (YYYY-MM-DD). */
  @EmptyToUndefined()
  @IsOptional()
  @Matches(DAY, { message: 'expiryTo must be YYYY-MM-DD' })
  expiryTo?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['createdAt', 'invoiceNumber', 'totalAmount', 'status', 'issuedAt'])
  sort_by?: 'createdAt' | 'invoiceNumber' | 'totalAmount' | 'status' | 'issuedAt';

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';
}
