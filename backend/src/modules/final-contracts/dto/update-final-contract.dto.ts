import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateFinalContractDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientCompanyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  clientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientTaxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSignatoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSignatoryTitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateStorage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateInboundHandling?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateOutboundHandling?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateValueAddedServices?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateReturnProcessing?: number;
}
