import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateManualCooldownDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  cooldownMinutes!: number;
}
