import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { OmsSalesChannelType } from '@prisma/client';

import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateOmsSalesChannelDto {
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @IsEnum(OmsSalesChannelType)
  channelType!: OmsSalesChannelType;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalStoreId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class OmsInboundWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
