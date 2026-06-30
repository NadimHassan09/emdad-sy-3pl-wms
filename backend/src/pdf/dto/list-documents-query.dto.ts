import { IsIn, IsUUID } from 'class-validator';

export class ListDocumentsQueryDto {
  @IsIn(['inbound_order', 'outbound_order'])
  referenceType!: 'inbound_order' | 'outbound_order';

  @IsUUID()
  referenceId!: string;
}
