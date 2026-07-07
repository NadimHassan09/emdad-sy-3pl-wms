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

export class CreateFinalContractDto {
  @IsUUID()
  companyId!: string;

  @IsDateString()
  issueDate!: string;

  @IsString()
  @MaxLength(200)
  clientCompanyName!: string;

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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateStorage!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateInboundHandling!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateOutboundHandling!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateValueAddedServices!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rateReturnProcessing!: number;
}
