import { IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AssignCycleCountLineDto {
  @IsOptional()
  @IsUuidLoose()
  assignedWorkerId?: string | null;
}
