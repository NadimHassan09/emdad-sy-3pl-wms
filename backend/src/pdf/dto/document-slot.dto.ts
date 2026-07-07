import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { EmptyToUndefined } from '../../common/transformers/query-transform';

export type CatalogDocumentType = 'grn' | 'delivery_note';

export class GetDocumentSlotQueryDto {
  @IsIn(['grn', 'delivery_note'])
  type!: CatalogDocumentType;
}

export class UpdateDocumentSlotDto {
  @IsIn(['grn', 'delivery_note'])
  type!: CatalogDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  poNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  driver?: string;
}
