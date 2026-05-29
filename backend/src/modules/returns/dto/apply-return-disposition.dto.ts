import { ReturnItemDisposition } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class ApplyReturnDispositionDto {
  @IsOptional()
  @IsEnum(ReturnItemDisposition)
  disposition?: ReturnItemDisposition;

  @IsOptional()
  @IsUuidLoose()
  targetLocationId?: string;
}
