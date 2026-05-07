import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 3)
  country?: string;
}
