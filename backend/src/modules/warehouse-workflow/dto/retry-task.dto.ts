import { IsOptional, IsString } from 'class-validator';

export class RetryTaskDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
