import { IsIn, IsString, MinLength } from 'class-validator';

export class SkipTaskDto {
  @IsIn(['qc', 'pack'])
  skip_target!: 'qc' | 'pack';

  @IsString()
  @MinLength(4)
  reason!: string;
}
