import { IsArray, IsOptional, IsString, Length } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateCycleCountDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  warehouseId!: string;

  /** When omitted, snapshot all on-hand products in the warehouse. */
  @IsOptional()
  @IsArray()
  @IsUuidLoose({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @IsOptional()
  @IsUuidLoose()
  assignedWorkerId?: string;
}
