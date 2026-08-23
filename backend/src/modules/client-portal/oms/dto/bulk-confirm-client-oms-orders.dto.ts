import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

import { IsUuidLoose } from '../../../../common/validators/is-uuid-loose';

export class BulkConfirmClientOmsOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUuidLoose({ each: true })
  ids!: string[];
}
