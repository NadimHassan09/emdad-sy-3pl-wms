import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateOmsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUuidLoose({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class OmsBatchMembershipDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUuidLoose({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
