import { IsIn } from 'class-validator';

export class UpdateInvoiceStatusDto {
  @IsIn(['paid', 'cancelled', 'unpaid'])
  status!: 'paid' | 'cancelled' | 'unpaid';
}
