import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ConnectShippingProviderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  username!: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class ShippingMethodDto {
  @IsOptional()
  @IsEnum(['manual', 'carrier'] as const)
  shippingMethod?: 'manual' | 'carrier';
}
