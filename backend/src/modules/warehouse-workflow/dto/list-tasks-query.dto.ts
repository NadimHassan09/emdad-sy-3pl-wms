import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Default page size for task list UI (lean summary rows). */
export const TASK_LIST_DEFAULT_LIMIT = 50;

/** Hard cap — UI should use 25–50; reports may request up to this with includeRunnability. */
export const TASK_LIST_MAX_LIMIT = 2000;

export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  taskType?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  updatedFrom?: string;

  @IsOptional()
  @IsString()
  updatedTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TASK_LIST_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /**
   * When true, includes runnability flags (extra queries + requiredSkills).
   * Default false for lean list payloads. Reports set true.
   */
  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  includeRunnability?: string;
}

export function parseIncludeRunnability(raw: string | undefined): boolean {
  return raw === 'true' || raw === '1';
}
