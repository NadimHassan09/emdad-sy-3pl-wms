import { IsOptional } from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AssignCycleCountDto {
  @IsOptional()
  @IsUuidLoose()
  assignedWorkerId?: string | null;
}
