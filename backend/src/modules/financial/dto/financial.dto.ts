import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import {
  FinancialTransactionCategory,
  FinancialTransactionType,
  ClientPayoutStatus,
} from '@prisma/client';

export class PostManualAdjustmentDto {
  @IsString()
  companyId!: string;

  @IsEnum(FinancialTransactionType)
  type!: FinancialTransactionType;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(FinancialTransactionCategory)
  category?: FinancialTransactionCategory;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class UpdateFinancialPolicyDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateClientPayoutRequestDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountHolder?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewPayoutDto {
  @IsEnum(ClientPayoutStatus)
  status!: ClientPayoutStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class RecordPayoutPaidDto {
  @IsOptional()
  @IsString()
  payoutReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmCodCollectionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmCodRemittanceDto {
  @IsOptional()
  @IsString()
  remittanceReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListFinancialTransactionsQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsEnum(FinancialTransactionType)
  type?: FinancialTransactionType;

  @IsOptional()
  @IsEnum(FinancialTransactionCategory)
  category?: FinancialTransactionCategory;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 25;
}

export class ListPayoutsQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsEnum(ClientPayoutStatus)
  status?: ClientPayoutStatus;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 25;
}

export class ListCodFinancialQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 25;
}
