import { BackupStoragePolicy } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsEnum(BackupStoragePolicy)
  storagePolicy?: BackupStoragePolicy;
}
