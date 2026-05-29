import { ReturnItemCondition, ReturnItemDisposition } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class InspectReturnLineDto {
  @IsEnum(ReturnItemCondition)
  condition!: ReturnItemCondition;

  @IsOptional()
  @IsEnum(ReturnItemDisposition)
  disposition?: ReturnItemDisposition;

  @IsOptional()
  @IsUuidLoose()
  targetLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspectionNotes?: string;
}
