import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class RegisterShippingWebhookDto {
  @IsString()
  @IsUrl({ require_tld: true, protocols: ['https'] })
  webhookUrl!: string;

  /** Optional. Sila issues its own `whsec_…` secret. Babel uses this as `webhook.key`. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  secret?: string;
}
