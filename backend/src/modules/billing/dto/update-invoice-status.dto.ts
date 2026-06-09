import { IsIn } from 'class-validator';

export class UpdateInvoiceStatusDto {
  @IsIn(['paid', 'cancelled', 'open'])
  status!: 'paid' | 'cancelled' | 'open';
}
