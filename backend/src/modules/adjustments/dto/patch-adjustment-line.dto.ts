import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class PatchAdjustmentLineDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantityAfter?: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reasonNote?: string;
}
