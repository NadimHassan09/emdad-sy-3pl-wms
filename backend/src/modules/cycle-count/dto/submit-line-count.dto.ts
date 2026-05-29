import { IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class SubmitLineCountDto {
  @IsNumberString()
  actualQuantity!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  countNotes?: string;
}
