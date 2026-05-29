import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { CYCLE_COUNT_INTERVAL_DAYS } from '../cycle-count.constants';

export class UpsertCycleCountScheduleDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsUuidLoose()
  warehouseId!: string;

  @IsInt()
  @IsIn([...CYCLE_COUNT_INTERVAL_DAYS])
  intervalDays!: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  includeZeroOnHand?: boolean;
}
