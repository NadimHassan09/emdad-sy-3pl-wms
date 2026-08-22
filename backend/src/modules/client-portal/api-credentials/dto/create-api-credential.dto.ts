import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiCredentialScope } from '@prisma/client';

export class CreateApiCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEnum(ApiCredentialScope)
  scope!: ApiCredentialScope;
}
