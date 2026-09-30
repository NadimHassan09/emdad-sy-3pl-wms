import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
} from 'class-validator';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

/** Bulk approve OMS orders from the admin OMS Orders page. */
export class BulkApproveOmsOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUuidLoose({ each: true })
  ids!: string[];
}
