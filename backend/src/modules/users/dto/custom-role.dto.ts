import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomRolePermissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  module!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  action!: string;

  @IsBoolean()
  allowed!: boolean;
}

export class UpsertCustomRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CustomRolePermissionDto)
  permissions?: CustomRolePermissionDto[];
}
