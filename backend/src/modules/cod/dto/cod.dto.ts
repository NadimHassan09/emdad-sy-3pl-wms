import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CodRecordStatus } from '@prisma/client';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../../common/transformers/query-transform';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ListCodRecordsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(CodRecordStatus)
  status?: CodRecordStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  omsOrderId?: string;

  /** Matches order number, client name, or recipient name. */
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateCodAdjustmentDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateCodStatusDto {
  @IsEnum(CodRecordStatus)
  status!: CodRecordStatus;
}
