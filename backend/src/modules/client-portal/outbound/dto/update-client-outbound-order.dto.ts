import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** What a client may change on an outbound order the warehouse has not approved yet (lines: delete and recreate). */
export class UpdateClientOutboundOrderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  destinationAddress?: string;

  @IsOptional()
  @IsDateString()
  requiredShipDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
