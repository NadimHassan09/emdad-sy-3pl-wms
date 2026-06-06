import { IsBoolean, IsOptional, Equals } from 'class-validator';

export class FactoryResetDto {
  @Equals('FACTORY RESET')
  confirmPhrase!: string;

  @IsOptional()
  @IsBoolean()
  createPreSnapshot?: boolean = true;
}
