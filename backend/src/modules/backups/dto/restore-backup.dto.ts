import { IsBoolean, IsOptional, Equals } from 'class-validator';

export class RestoreBackupDto {
  @Equals('RESTORE')
  confirmPhrase!: string;

  @IsOptional()
  @IsBoolean()
  createPreSnapshot?: boolean = true;
}
