import { IsOptional, IsString, Length } from 'class-validator';

export class SkipCycleCountLineDto {
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  countNotes?: string;
}
