import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaseTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  minutes?: number;
}
